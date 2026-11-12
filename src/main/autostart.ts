import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Passed by the autostart entry so login starts DeskKnock in the tray without opening the window. */
export const HIDDEN_FLAG = '--hidden'

function quoteExec(execPath: string): string {
  if (!/[\s"'\\]/.test(execPath)) return execPath
  return `"${execPath.replace(/(["`$\\])/g, '\\$1')}"`
}

/** An entry an older DeskKnock wrote (no --hidden) that the user hasn't disabled. */
function isOutdatedOwnEntry(text: string): boolean {
  return /^Name=DeskKnock\s*$/m.test(text)
    && !/^Exec=.*\s--hidden\b/m.test(text)
    && !/^X-GNOME-Autostart-enabled=false\s*$/m.test(text)
}

/**
 * The .deb installs a system-wide /etc/xdg/autostart/deskknock.desktop, so we no longer create a per-user
 * entry. An older DeskKnock wrote ~/.config/autostart/deskknock.desktop without --hidden; that file overrides
 * the system one, so upgrade it in place. User-disabled or foreign files are left alone.
 */
export function ensureAutostart(homeDir: string, execPath: string): void {
  const file = join(homeDir, '.config', 'autostart', 'deskknock.desktop')
  if (!existsSync(file)) return
  let text: string
  try { text = readFileSync(file, 'utf8') } catch { return }
  if (!isOutdatedOwnEntry(text)) return
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=DeskKnock',
    'Comment=Knock on a colleague\'s screen',
    `Exec=${quoteExec(execPath)} ${HIDDEN_FLAG}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  writeFileSync(file, content)
}
