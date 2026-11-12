import { app } from 'electron'
import { startApp } from './app'

app.commandLine.appendSwitch('ozone-platform', 'x11')

// A second instance would share our config dir and peerId and fight over peer sockets.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let showMainWindow: (() => void) | null = null
  // A background (--hidden) launch while already running must not pop the window up.
  app.on('second-instance', (_e, argv) => { if (!argv.includes('--hidden')) showMainWindow?.() })
  app.whenReady().then(() => { showMainWindow = startApp() })

  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {})
}
