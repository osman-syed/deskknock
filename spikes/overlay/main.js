// THROWAWAY SPIKE: can a transparent, always-on-top character overlay work on GNOME Wayland?
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const mode = process.env.SPIKE_MODE || 'x11';
if (mode === 'x11') app.commandLine.appendSwitch('ozone-platform', 'x11');
else app.commandLine.appendSwitch('ozone-platform', 'wayland');

const delay = Number(process.env.SPIKE_DELAY || 8);

app.whenReady().then(() => {
  console.log(`[spike] mode=${mode}, showing in ${delay}s — switch to a fullscreen app now`);
  setTimeout(show, delay * 1000);
});

function show() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 460, H = 320;
  const win = new BrowserWindow({
    width: W, height: H,
    x: workArea.x + workArea.width - W, y: workArea.y + workArea.height - H,
    transparent: true, frame: false, resizable: false, skipTaskbar: true,
    focusable: false, alwaysOnTop: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile('overlay.html');
  win.once('ready-to-show', () => win.showInactive());
  setTimeout(() => {
    const b = win.getBounds();
    console.log(`[spike] requested x=${workArea.x + workArea.width - W} y=${workArea.y + workArea.height - H}, actual x=${b.x} y=${b.y}, onTop=${win.isAlwaysOnTop()}`);
  }, 1500);
}

ipcMain.on('reply', (_e, answer) => {
  console.log(`[spike] reply: ${answer}`);
  app.quit();
});
