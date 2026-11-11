import { app } from 'electron'
import { startApp } from './app'

app.commandLine.appendSwitch('ozone-platform', 'x11')

app.whenReady().then(startApp)

// Keep running in the tray when the window is closed.
app.on('window-all-closed', () => {})
