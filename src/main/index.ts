import { app } from 'electron'
import { startApp } from './app'

app.commandLine.appendSwitch('ozone-platform', 'x11')

// A second instance would share our config dir and peerId and fight over peer sockets.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let showMainWindow: (() => void) | null = null
  app.on('second-instance', () => showMainWindow?.())
  app.whenReady().then(() => { showMainWindow = startApp() })

  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {})
}
