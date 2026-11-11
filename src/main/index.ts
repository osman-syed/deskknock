import { app, BrowserWindow, Menu, type Tray } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { OverlayManager } from './overlay'
import { DEFAULT_CHARACTER } from '../core/character'
import { createTray } from './tray'
import { ensureAutostart } from './autostart'

app.commandLine.appendSwitch('ozone-platform', 'x11')

const overlay = new OverlayManager()
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

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

  mainWindow = win
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
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
  // Pause persistence/broadcast is wired in Task 9.
  tray = createTray({
    paused: false,
    onOpen: () => { mainWindow?.show(); mainWindow?.focus() },
    onTogglePause: () => {},
    onQuit: () => app.quit()
  })
  if (app.isPackaged) ensureAutostart(homedir(), process.execPath)
})

app.on('before-quit', () => { quitting = true })

// Keep running in the tray when the window is closed.
app.on('window-all-closed', () => {})
