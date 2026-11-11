import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

app.commandLine.appendSwitch('ozone-platform', 'x11')

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

app.whenReady().then(createMainWindow)

app.on('window-all-closed', () => {
  app.quit()
})
