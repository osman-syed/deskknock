import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { Answer } from '../core/protocol';
import type { PeerView } from '../core/peers';
import { overlayBounds, pickEdge, type Edge } from '../core/edge';

const SIZE = { w: 460, h: 320 };
const REPLY_MS = 8000;

type Payload = {
  mode: 'knock' | 'reply'; id: string; name: string; character: PeerView['character']; photo: string | null;
  reminder: boolean; waitingBehind: number; muted: boolean; edge: Edge; answer?: 'coming' | 'busy5';
};

export class OverlayManager {
  private win: BrowserWindow | null = null;
  private loaded = false;
  private pending: Payload | null = null;
  private current: Payload | null = null;
  private replyTimer: NodeJS.Timeout | null = null;
  private answerCb: (id: string, a: Answer) => void = () => {};

  constructor() {
    ipcMain.on('overlay:answer', (e, id: string, a: Answer) => {
      if (!this.win || e.sender !== this.win.webContents) return;
      this.answerCb(id, a);
    });
  }

  onAnswer(cb: (id: string, a: Answer) => void): void { this.answerCb = cb; }

  showKnock(p: { id: string; caller: PeerView; photo: Buffer | null; reminder: boolean; waitingBehind: number; muted: boolean }): void {
    const cur = this.current;
    if (cur && cur.mode === 'knock' && cur.id === p.id) {
      // Idempotent: only the queue count / reminder text change; renderer keeps the same character and plays no chime.
      this.send({ ...cur, reminder: p.reminder, waitingBehind: p.waitingBehind });
      return;
    }
    this.clearReplyTimer();
    this.send({
      mode: 'knock', id: p.id, name: p.caller.name, character: p.caller.character,
      photo: dataUrl(p.photo), reminder: p.reminder, waitingBehind: p.waitingBehind, muted: p.muted,
      edge: pickEdge(),
    }, true);
  }

  hide(id: string): void {
    if (this.current && this.current.mode === 'knock' && this.current.id === id) this.close();
  }

  showReply(p: { from: PeerView; answer: 'coming' | 'busy5' }): void {
    this.clearReplyTimer();
    this.send({
      mode: 'reply', id: `reply-${Date.now()}`, name: p.from.name, character: p.from.character, photo: null,
      reminder: false, waitingBehind: 0, muted: true, edge: pickEdge(), answer: p.answer,
    }, true);
    this.replyTimer = setTimeout(() => this.close(), REPLY_MS);
  }

  private send(payload: Payload, reposition = false): void {
    this.current = payload;
    const win = this.ensureWindow();
    if (reposition) {
      const wa = screen.getPrimaryDisplay().workArea;
      win.setBounds(overlayBounds(payload.edge, wa, SIZE));
    }
    if (this.loaded) win.webContents.send('overlay:show', payload);
    else this.pending = payload;
  }

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const wa = screen.getPrimaryDisplay().workArea;
    const b = overlayBounds(this.current?.edge ?? 'bottom-right', wa, SIZE);
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
    this.loaded = false;
    win.webContents.on('did-finish-load', () => {
      this.loaded = true;
      if (this.pending) { win.webContents.send('overlay:show', this.pending); this.pending = null; }
    });
    win.once('ready-to-show', () => win.showInactive());
    win.on('closed', () => { if (this.win === win) { this.win = null; this.loaded = false; } });
    if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`);
    else win.loadFile(join(__dirname, '../renderer/overlay/index.html'));
    return win;
  }

  private clearReplyTimer(): void {
    if (this.replyTimer) { clearTimeout(this.replyTimer); this.replyTimer = null; }
  }

  private close(): void {
    this.clearReplyTimer();
    this.current = null;
    this.pending = null;
    const win = this.win;
    this.win = null;
    this.loaded = false;
    if (win && !win.isDestroyed()) win.destroy();
  }
}

function dataUrl(png: Buffer | null): string | null {
  return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}
