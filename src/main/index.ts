import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { OverlayManager } from './overlay'
import { DEFAULT_CHARACTER } from '../core/character'

app.commandLine.appendSwitch('ozone-platform', 'x11')

const overlay = new OverlayManager()

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'DeskKnock',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/main/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/main/index.html'))
  }
}

// TEMPORARY (removed in Task 9): manual overlay check.
function installDevMenu(): void {
  let n = 0
  const caller = {
    peerId: 'self', name: 'Osman', appVersion: '0', protocolVersion: 1, character: DEFAULT_CHARACTER,
    photoHash: null, online: true, compatible: true, paused: false, away: false
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Dev',
        submenu: [
          {
            label: 'Test knock from self',
            click: () => overlay.showKnock({ id: `test-${++n}`, caller, photo: null, reminder: false, waitingBehind: 0, muted: false })
          }
        ]
      }
    ])
  )
  overlay.onAnswer((id) => overlay.hide(id))
}

app.whenReady().then(() => {
  installDevMenu()
  createMainWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
