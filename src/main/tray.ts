import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'

export interface TrayOptions {
  onOpen(): void
  onTogglePause(paused: boolean): void
  onQuit(): void
  paused: boolean
}

export function createTray(opts: TrayOptions): Tray {
  const dir = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
  const icon = nativeImage.createFromPath(join(dir, 'tray.png'))
  const hi = join(dir, 'tray@2x.png')
  icon.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(hi).toPNG() })
  const tray = new Tray(icon)
  tray.setToolTip('DeskKnock')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open DeskKnock', click: () => opts.onOpen() },
      { label: 'Pause knocks', type: 'checkbox', checked: opts.paused, click: (item) => opts.onTogglePause(item.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => opts.onQuit() }
    ])
  )
  tray.on('click', () => opts.onOpen())
  return tray
}
