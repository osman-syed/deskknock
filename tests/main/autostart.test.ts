import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureAutostart } from '../../src/main/autostart'

describe('autostart', () => {
  it('ensureAutostart writes desktop file once', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    const file = join(home, '.config', 'autostart', 'deskknock.desktop')
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('[Desktop Entry]')
    expect(text).toContain('Type=Application')
    expect(text).toContain('Name=DeskKnock')
    expect(text).toContain('Exec=/opt/DeskKnock/deskknock')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
    utimesSync(file, 1000, 1000)
    const before = statSync(file).mtimeMs
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    expect(statSync(file).mtimeMs).toBe(before)
  })

  it('quotes execPath containing spaces', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    ensureAutostart(home, '/opt/Desk Knock/deskknock')
    const text = readFileSync(join(home, '.config', 'autostart', 'deskknock.desktop'), 'utf8')
    expect(text).toContain('Exec="/opt/Desk Knock/deskknock"')
  })
})
