import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function quoteExec(execPath: string): string {
  if (!/[\s"'\\]/.test(execPath)) return execPath
  return `"${execPath.replace(/(["`$\\])/g, '\\$1')}"`
}

/** Writes ~/.config/autostart/deskknock.desktop if absent. */
export function ensureAutostart(homeDir: string, execPath: string): void {
  const dir = join(homeDir, '.config', 'autostart')
  const file = join(dir, 'deskknock.desktop')
  if (existsSync(file)) return
  mkdirSync(dir, { recursive: true })
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=DeskKnock',
    'Comment=Knock on a colleague\'s screen',
    `Exec=${quoteExec(execPath)}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  writeFileSync(file, content)
}
