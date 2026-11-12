import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'

export interface TrayTeammate {
  label: string
  enabled: boolean
  onClick(): void
}

export interface TrayOptions {
  onOpen(): void
  onTogglePause(paused: boolean): void
  onQuit(): void
  isPaused(): boolean
}

export interface TrayHandle {
  tray: Tray
  /** Rebuilds the context menu with these teammate rows at the top. */
  updateTeammates(items: TrayTeammate[]): void
  destroy(): void
}

// Menu labels treat '&' as a mnemonic marker; '&&' shows a literal '&'.
const escapeLabel = (s: string): string => s.replace(/&/g, '&&')

export function createTray(opts: TrayOptions): TrayHandle {
  const dir = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
  const icon = nativeImage.createFromPath(join(dir, 'tray.png'))
  const hi = join(dir, 'tray@2x.png')
  icon.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(hi).toPNG() })
  const tray = new Tray(icon)
  tray.setToolTip('DeskKnock')

  const build = (teammates: TrayTeammate[]): void => {
    const rows: MenuItemConstructorOptions[] = teammates.length
      ? teammates.map((t) => ({ label: escapeLabel(t.label), enabled: t.enabled, click: () => t.onClick() }))
      : [{ label: 'No teammates online yet', enabled: false }]
    tray.setContextMenu(
      Menu.buildFromTemplate([
        ...rows,
        { type: 'separator' },
        { label: 'Pause knocks', type: 'checkbox', checked: opts.isPaused(), click: (item) => opts.onTogglePause(item.checked) },
        { label: 'Open DeskKnock', click: () => opts.onOpen() },
        { type: 'separator' },
        { label: 'Quit', click: () => opts.onQuit() }
      ])
    )
  }

  build([])
  // Not emitted on Linux (StatusNotifier shows the menu), kept for other platforms.
  tray.on('click', () => opts.onOpen())
  return {
    tray,
    updateTeammates: build,
    destroy: () => tray.destroy()
  }
}
