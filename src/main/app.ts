import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { Store, type Settings } from '../core/store';
import { PeerRegistry, type PeerView } from '../core/peers';
import { PROTOCOL_VERSION, type Message } from '../core/protocol';
import { KnockEngine, type OutgoingView } from '../core/knockEngine';
import { DEFAULT_CHARACTER, isCharacter, randomCharacter, type Character } from '../core/character';
import { TRAY_EMPTY_LABEL, trayHeader, trayTeammateItems } from '../core/trayItems';
import type { AppState } from '../core/appState';
import { listenErrorMessage } from '../core/network';
import { Transport } from './transport';
import { Discovery } from './discovery';
import { OverlayManager } from './overlay';
import { watchScreenLock } from './lockWatcher';
import { createTray, type TrayHandle } from './tray';
import { HeadIconCache } from './headIcon';
import { ensureAutostart, HIDDEN_FLAG } from './autostart';
import { resizePhoto, MAX_PHOTO_INPUT_BYTES } from './photo';

const CONFIG_DIR = join(homedir(), '.config', 'DeskKnock');

function defaultName(): string {
  try { return userInfo().username; } catch { return 'Teammate'; }
}

/** Accept only well-formed settings from the renderer; peerId and paused are not renderer-owned. */
function sanitizeSettings(raw: unknown, cur: Settings): Settings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== 'string' || typeof o.muted !== 'boolean') return null;
  if (typeof o.port !== 'number' || !Number.isInteger(o.port) || o.port < 1 || o.port > 65535) return null;
  if (!Array.isArray(o.manualPeers) || !o.manualPeers.every((x) => typeof x === 'string')) return null;
  return {
    ...cur,
    name: o.name.trim().slice(0, 64) || cur.name,
    muted: o.muted,
    port: o.port,
    manualPeers: (o.manualPeers as string[]).map((x) => x.trim()).filter(Boolean),
  };
}

/** Starts everything; returns a function that brings the main window to the front. */
export function startApp(): () => void {
  const store = new Store(CONFIG_DIR);
  let settings = store.loadSettings();
  if (!settings.name) {
    settings = { ...settings, name: defaultName() };
    store.saveSettings(settings);
  }
  // First run: give the user a random character and stay in the tray; they can edit it later from Settings.
  const firstRun = !store.hasCharacter();
  if (firstRun) store.saveCharacter(randomCharacter());
  let character = store.loadCharacter();
  let photo = store.loadPhoto();
  const appVersion = app.getVersion();

  let mainWindow: BrowserWindow | null = null;
  let builderWindow: BrowserWindow | null = null;
  let tray: TrayHandle | null = null;
  let quitting = false;
  let locked = false;
  let networkError: string | null = null;

  const hello = (): Extract<Message, { t: 'hello' }> => ({
    t: 'hello', peerId: settings.peerId, name: settings.name, appVersion,
    protocolVersion: PROTOCOL_VERSION, character, photoHash: photo?.hash ?? null,
  });
  const presence = (): Message => ({ t: 'presence', paused: settings.paused, away: locked });

  // ---------- core objects ----------
  const transport = new Transport({
    port: settings.port,
    hello,
    photo: () => photo,
    hasPhoto: (hash) => store.loadPeerPhoto(hash) !== null,
  });
  const registry = new PeerRegistry(store.loadCachedPeers().filter((p) => p.peerId !== settings.peerId));
  const overlay = new OverlayManager();
  const outgoing = new Map<string, OutgoingView>();

  const peerView = (peerId: string): PeerView =>
    registry.list().find((p) => p.peerId === peerId) ?? {
      peerId, name: 'Someone', appVersion: '', protocolVersion: PROTOCOL_VERSION, character: DEFAULT_CHARACTER,
      photoHash: null, online: true, compatible: true, paused: false, away: false,
    };

  // ---------- tray menu (coalesced to at most ~2 rebuilds/s) ----------
  const TRAY_MIN_INTERVAL_MS = 500;
  let trayTimer: NodeJS.Timeout | null = null;
  let lastTrayBuild = 0;
  // Face icons render asynchronously (sharp); rows show without one until ready, then the menu is rebuilt.
  const faceIcons = new HeadIconCache(
    ({ x1, x2 }) => {
      const img = nativeImage.createFromBuffer(x1, { scaleFactor: 1 });
      img.addRepresentation({ scaleFactor: 2, buffer: x2 });
      return img;
    },
    () => scheduleTray(),
  );
  const rebuildTray = (): void => {
    trayTimer = null;
    if (!tray || quitting) return;
    lastTrayBuild = Date.now();
    const peers = registry.list();
    const items = trayTeammateItems(peers, Object.fromEntries(outgoing), lastTrayBuild, settings.peerId);
    tray.update({
      header: trayHeader(peers, settings.peerId),
      emptyLabel: TRAY_EMPTY_LABEL,
      teammates: items.map((i) => ({
        label: i.label,
        enabled: i.enabled,
        icon: faceIcons.get(i.character),
        iconKey: faceIcons.keyFor(i.character),
        onClick: () => {
          if (i.action === 'knock') knockPeer(i.peerId);
          else if (i.action === 'cancel') cancelKnock(i.peerId);
        },
      })),
    });
  };
  const scheduleTray = (): void => {
    if (trayTimer || quitting) return;
    trayTimer = setTimeout(rebuildTray, Math.max(0, lastTrayBuild + TRAY_MIN_INTERVAL_MS - Date.now()));
  };

  // ---------- state push (coalesced) ----------
  let pushQueued = false;
  const pushState = (): void => {
    scheduleTray();
    if (pushQueued) return;
    pushQueued = true;
    setImmediate(() => {
      pushQueued = false;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const s: AppState = {
        peers: registry.list().filter((p) => p.peerId !== settings.peerId),
        outgoing: Object.fromEntries(outgoing),
        updateAvailable: registry.newerAppVersionSeen(appVersion),
        networkError,
        settings,
      };
      mainWindow.webContents.send('deskknock:state', s);
    });
  };

  const engine = new KnockEngine({
    send: (peerId, m) => transport.send(peerId, m),
    showIncoming: (k, waitingBehind) => {
      const caller = peerView(k.fromPeerId);
      overlay.showKnock({
        id: k.id, caller, reminder: k.reminder, waitingBehind, muted: settings.muted,
        photo: caller.photoHash ? store.loadPeerPhoto(caller.photoHash) : null,
      });
    },
    hideIncoming: (id) => overlay.hide(id),
    showReply: (fromPeerId, answer) => overlay.showReply({ from: peerView(fromPeerId), answer }),
    outgoingChanged: (peerId, view) => { outgoing.set(peerId, view); pushState(); },
  });
  engine.setPaused(settings.paused);
  overlay.onAnswer((id, a) => engine.answer(id, a));

  // ---------- transport → registry / engine ----------
  transport.on('hello', (_peerId: string, h: Extract<Message, { t: 'hello' }>) => {
    registry.upsertFromHello(h);
    const { t: _t, ...profile } = h;
    store.cachePeer(profile);
  });
  transport.on('photo', (_peerId: string, hash: string, png: Buffer) => {
    store.cachePeerPhoto(hash, png);
  });
  transport.on('online', (peerId: string, online: boolean) => {
    registry.setOnline(peerId, online);
    engine.peerOnline(peerId, online);
    if (online) transport.send(peerId, presence());
  });
  transport.on('message', (peerId: string, m: Message) => {
    if (m.t === 'presence') {
      const p = { paused: m.paused, away: m.away };
      registry.setPresence(peerId, p);
      engine.peerPresence(peerId, p);
    } else {
      engine.onMessage(peerId, m);
    }
  });
  registry.on('changed', pushState);

  const discovery = new Discovery({
    peerId: settings.peerId, name: settings.name, port: settings.port,
    connect: (host, port) => transport.connect(host, port),
    isConnected: (peerId) => transport.isConnected(peerId),
  });

  transport.listen().then(
    () => {
      discovery.start();
      discovery.setManualPeers(settings.manualPeers);
    },
    (err) => {
      // Without our own port we can't be reached; don't advertise or dial under our peerId.
      console.error(`DeskKnock: cannot listen on port ${settings.port}:`, err?.message ?? err);
      networkError = listenErrorMessage(settings.port, err);
      void transport.close();
      pushState();
    },
  );

  const tickTimer = setInterval(() => engine.tick(), 1000);

  // ---------- lock / pause ----------
  let stopLockWatch: () => void = () => {};
  void watchScreenLock((l) => {
    locked = l;
    engine.setLocked(l);
    transport.broadcast(presence());
  }).then((stop) => {
    if (quitting) stop(); else stopLockWatch = stop;
  });

  const setPaused = (paused: boolean): void => {
    if (settings.paused === paused) return;
    settings = { ...settings, paused };
    store.saveSettings(settings);
    engine.setPaused(paused);
    transport.broadcast(presence());
    pushState();
  };

  // ---------- knock / cancel (shared by the main window and the tray menu) ----------
  const knockPeer = (peerId: unknown): void => {
    if (typeof peerId !== 'string' || peerId === settings.peerId) return;
    const p = registry.list().find((x) => x.peerId === peerId);
    if (!p || !p.online || !p.compatible) return; // engine doesn't know compatibility
    engine.knock(peerId);
  };
  const cancelKnock = (peerId: unknown): void => {
    if (typeof peerId === 'string') engine.cancel(peerId);
  };

  // ---------- IPC from the main window ----------
  const fromMain = (e: Electron.IpcMainEvent): boolean => !!mainWindow && e.sender === mainWindow.webContents;

  ipcMain.on('deskknock:ready', (e) => { if (fromMain(e)) pushState(); });
  ipcMain.on('deskknock:knock', (e, peerId: unknown) => { if (fromMain(e)) knockPeer(peerId); });
  ipcMain.on('deskknock:cancel', (e, peerId: unknown) => { if (fromMain(e)) cancelKnock(peerId); });
  ipcMain.on('deskknock:saveSettings', (e, raw: unknown) => {
    if (!fromMain(e)) return;
    const next = sanitizeSettings(raw, settings);
    if (!next) { console.warn('ignoring invalid settings'); return; }
    const prev = settings;
    settings = next;
    store.saveSettings(settings);
    if (next.name !== prev.name) transport.broadcast(hello());
    if (!networkError && next.manualPeers.join('\n') !== prev.manualPeers.join('\n')) discovery.setManualPeers(next.manualPeers);
    // muted is read on each knock; port applies after restart.
    pushState();
  });

  // ---------- IPC from the builder window ----------
  const fromBuilder = (e: Electron.IpcMainInvokeEvent): boolean =>
    !!builderWindow && !builderWindow.isDestroyed() && e.sender === builderWindow.webContents;

  ipcMain.handle('builder:load', (e) => {
    if (!fromBuilder(e)) throw new Error('forbidden');
    return { character, photo: photo ? new Uint8Array(photo.png) : null };
  });
  ipcMain.handle('builder:save', async (e, c: unknown, rawPhoto: unknown) => {
    if (!fromBuilder(e)) throw new Error('forbidden');
    if (!isCharacter(c)) throw new Error('invalid character');
    // undefined = keep the stored photo untouched; null = remove it; bytes = replace it.
    let png: Buffer | null = null;
    if (rawPhoto !== null && rawPhoto !== undefined) {
      const bytes = rawPhoto instanceof ArrayBuffer ? new Uint8Array(rawPhoto)
        : ArrayBuffer.isView(rawPhoto) ? new Uint8Array(rawPhoto.buffer, rawPhoto.byteOffset, rawPhoto.byteLength) : null;
      if (!bytes) throw new Error('invalid photo');
      if (bytes.byteLength > MAX_PHOTO_INPUT_BYTES) throw new Error('photo too large');
      png = await resizePhoto(Buffer.from(bytes));
    }
    const next: Character = { ...c };
    store.saveCharacter(next);
    if (png) store.savePhoto(png);
    else if (rawPhoto === null) store.clearPhoto();
    character = next;
    if (rawPhoto !== undefined) photo = store.loadPhoto();
    transport.broadcast(hello());
    pushState();
    const win = builderWindow;
    setImmediate(() => { if (win && !win.isDestroyed()) win.close(); });
  });
  ipcMain.on('deskknock:editCharacter', (e) => { if (fromMain(e)) openBuilder(); });

  // ---------- windows ----------
  const openBuilder = (): void => {
    if (builderWindow && !builderWindow.isDestroyed()) {
      if (builderWindow.isMinimized()) builderWindow.restore();
      builderWindow.show();
      builderWindow.focus();
      return;
    }
    const win = new BrowserWindow({
      width: 760,
      height: 520,
      title: 'My character',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    builderWindow = win;
    win.on('closed', () => { if (builderWindow === win) builderWindow = null; });
    if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/builder/index.html`);
    else win.loadFile(join(__dirname, '../renderer/builder/index.html'));
  };

  const createMainWindow = (): void => {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      title: 'DeskKnock',
      // Login autostart passes --hidden, and first run starts in the background: stay in the tray.
      // The window still exists so state pushes work.
      show: !firstRun && !process.argv.includes(HIDDEN_FLAG),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    mainWindow = win;
    win.on('close', (e) => {
      if (quitting) return;
      e.preventDefault();
      win.hide();
    });
    if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/main/index.html`);
    else win.loadFile(join(__dirname, '../renderer/main/index.html'));
  };

  const showMainWindow = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  createMainWindow();
  tray = createTray({
    isPaused: () => settings.paused,
    onOpen: showMainWindow,
    onTogglePause: (paused) => setPaused(paused),
    onQuit: () => app.quit(),
    initial: { header: 'TEAM', emptyLabel: TRAY_EMPTY_LABEL, teammates: [] },
  });
  scheduleTray();
  // Login autostart comes from /etc/xdg/autostart (the .deb); this only upgrades an old per-user entry.
  if (app.isPackaged) ensureAutostart(homedir(), process.execPath);

  app.on('before-quit', () => {
    quitting = true;
    clearInterval(tickTimer);
    if (trayTimer) clearTimeout(trayTimer);
    stopLockWatch();
    discovery.stop();
    void transport.close();
    tray?.destroy();
    tray = null;
  });

  return showMainWindow;
}
