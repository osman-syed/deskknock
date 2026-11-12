import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import { join } from 'node:path'

export interface TrayTeammate {
  label: string
  enabled: boolean
  /** Face icon, or null while it renders / when rendering is unavailable. */
  icon: NativeImage | null
  /** Identifies `icon` for change detection ('' when there is none). */
  iconKey: string
  onClick(): void
}

export interface TrayModel {
  header: string
  /** Shown (disabled) instead of rows when there are no teammates. */
  emptyLabel: string
  teammates: TrayTeammate[]
}

export interface TrayOptions {
  onOpen(): void
  onTogglePause(paused: boolean): void
  onQuit(): void
  isPaused(): boolean
  /** Menu shown before the first update. */
  initial: TrayModel
}

export interface TrayHandle {
  tray: Tray
  /** Rebuilds the context menu with this header and teammate rows at the top. */
  update(model: TrayModel): void
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

  let lastKey: string | null = null
  const build = (m: TrayModel): void => {
    // Rebuilding an identical menu makes some panels flicker/close it; skip when nothing visible changed.
    // (Same label + enabled means the same click action, so the old closures are equivalent.)
    const key = JSON.stringify([
      opts.isPaused(),
      m.header,
      m.emptyLabel,
      m.teammates.map((t) => [t.label, t.enabled, t.iconKey])
    ])
    if (key === lastKey) return
    lastKey = key
    const rows: MenuItemConstructorOptions[] = m.teammates.length
      ? m.teammates.map((t) => ({
          label: escapeLabel(t.label),
          enabled: t.enabled,
          ...(t.icon ? { icon: t.icon } : {}),
          click: () => t.onClick()
        }))
      : [{ label: escapeLabel(m.emptyLabel), enabled: false }]
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: escapeLabel(m.header), enabled: false },
        ...rows,
        { type: 'separator' },
        { label: '⏸  Pause knocks', type: 'checkbox', checked: opts.isPaused(), click: (item) => opts.onTogglePause(item.checked) },
        { label: '🏠  Open DeskKnock', click: () => opts.onOpen() },
        { type: 'separator' },
        { label: 'Quit', click: () => opts.onQuit() }
      ])
    )
  }

  build(opts.initial)
  // Not emitted on Linux (StatusNotifier shows the menu), kept for other platforms.
  tray.on('click', () => opts.onOpen())
  return {
    tray,
    update: build,
    destroy: () => tray.destroy()
  }
}
