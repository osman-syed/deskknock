import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { Answer } from '../core/protocol';
import type { PeerView } from '../core/peers';
import { overlayBounds, pickEdgeExcept, type Edge } from '../core/edge';

const SIZE = { w: 400, h: 260 };
const REPLY_MS = 8000;

type Payload = {
  mode: 'knock' | 'reply'; id: string; name: string; character: PeerView['character']; photo: string | null;
  reminder: boolean; waitingBehind: number; muted: boolean; edge: Edge; answer?: 'coming' | 'busy5';
};

/** One overlay window plus its payload hand-off state. */
class Slot {
  win: BrowserWindow | null = null;
  current: Payload | null = null;
  private ready = false;
  private pending: Payload | null = null;

  send(payload: Payload, reposition: boolean): void {
    this.current = payload;
    const win = this.ensureWindow();
    if (reposition) win.setBounds(overlayBounds(payload.edge, screen.getPrimaryDisplay().workArea, SIZE));
    if (this.ready) win.webContents.send('overlay:show', payload);
    else this.pending = payload;
  }

  /** Called when the renderer's listener is registered. */
  markReady(): void {
    this.ready = true;
    if (this.pending && this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('overlay:show', this.pending);
    }
    this.pending = null;
  }

  close(): void {
    this.current = null;
    this.pending = null;
    this.ready = false;
    const win = this.win;
    this.win = null;
    if (win && !win.isDestroyed()) win.destroy();
  }

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const b = overlayBounds(this.current?.edge ?? 'bottom-right', screen.getPrimaryDisplay().workArea, SIZE);
    // Flags proven in spikes/overlay/main.js on the target machine.
    const win = new BrowserWindow({
      ...b,
      transparent: true, frame: false, resizable: false, skipTaskbar: true,
      focusable: false, alwaysOnTop: true, hasShadow: false, show: false,
      webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);
    this.win = win;
    this.ready = false;
    win.once('ready-to-show', () => win.showInactive());
    win.on('closed', () => { if (this.win === win) { this.win = null; this.ready = false; } });
    if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`);
    else win.loadFile(join(__dirname, '../renderer/overlay/index.html'));
    return win;
  }
}

export class OverlayManager {
  private knock = new Slot();
  private reply = new Slot();
  private replyTimer: NodeJS.Timeout | null = null;
  private answerCb: (id: string, a: Answer) => void = () => {};

  constructor() {
    ipcMain.on('overlay:answer', (e, id: string, a: Answer) => {
      if (!this.knock.win || e.sender !== this.knock.win.webContents) return;
      this.answerCb(id, a);
    });
    ipcMain.on('overlay:ready', (e) => {
      for (const s of [this.knock, this.reply]) if (s.win && e.sender === s.win.webContents) s.markReady();
    });
  }

  onAnswer(cb: (id: string, a: Answer) => void): void { this.answerCb = cb; }

  showKnock(p: { id: string; caller: PeerView; photo: Buffer | null; reminder: boolean; waitingBehind: number; muted: boolean }): void {
    const cur = this.knock.current;
    if (cur && cur.id === p.id) {
      // Idempotent: only queue count / reminder text change; renderer keeps the same character and plays no chime.
      this.knock.send({ ...cur, reminder: p.reminder, waitingBehind: p.waitingBehind }, false);
      return;
    }
    this.knock.send({
      mode: 'knock', id: p.id, name: p.caller.name, character: p.caller.character,
      photo: dataUrl(p.photo), reminder: p.reminder, waitingBehind: p.waitingBehind, muted: p.muted,
      edge: pickEdgeExcept(this.reply.current?.edge ?? null),
    }, true);
  }

  hide(id: string): void {
    if (this.knock.current?.id === id) this.knock.close();
  }

  /** Reply peek lives in its own window, on a different edge from any visible knock. */
  showReply(p: { from: PeerView; answer: 'coming' | 'busy5' }): void {
    if (this.replyTimer) clearTimeout(this.replyTimer);
    this.reply.send({
      mode: 'reply', id: `reply-${Date.now()}`, name: p.from.name, character: p.from.character, photo: null,
      reminder: false, waitingBehind: 0, muted: true, edge: pickEdgeExcept(this.knock.current?.edge ?? null), answer: p.answer,
    }, true);
    this.replyTimer = setTimeout(() => { this.replyTimer = null; this.reply.close(); }, REPLY_MS);
  }
}

function dataUrl(png: Buffer | null): string | null {
  return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}
