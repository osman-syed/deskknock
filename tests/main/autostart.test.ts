import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureAutostart } from '../../src/main/autostart'

describe('autostart', () => {
  it('does not create a new per-user entry (the system-wide /etc/xdg one covers it)', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    expect(existsSync(join(home, '.config', 'autostart', 'deskknock.desktop'))).toBe(false)
  })

  const OLD = '[Desktop Entry]\nType=Application\nName=DeskKnock\nComment=x\nExec=/opt/DeskKnock/deskknock\nTerminal=false\n'
  const writeExisting = (home: string, text: string) => {
    const dir = join(home, '.config', 'autostart')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'deskknock.desktop'), text)
    return join(dir, 'deskknock.desktop')
  }

  it('upgrades an older DeskKnock entry that lacks --hidden', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    const file = writeExisting(home, OLD + 'X-GNOME-Autostart-enabled=true\n')
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('[Desktop Entry]')
    expect(text).toContain('Name=DeskKnock')
    expect(text).toContain('Exec=/opt/DeskKnock/deskknock --hidden')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
  })

  it('quotes execPath containing spaces when upgrading', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    const file = writeExisting(home, OLD)
    ensureAutostart(home, '/opt/Desk Knock/deskknock')
    expect(readFileSync(file, 'utf8')).toContain('Exec="/opt/Desk Knock/deskknock" --hidden')
  })

  it('leaves an up-to-date entry untouched', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    const file = writeExisting(home, OLD + 'X-GNOME-Autostart-enabled=true\n')
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    utimesSync(file, 1000, 1000)
    const before = statSync(file).mtimeMs
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    expect(statSync(file).mtimeMs).toBe(before)
  })

  it('leaves a user-disabled entry alone', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    const text = OLD + 'X-GNOME-Autostart-enabled=false\n'
    const file = writeExisting(home, text)
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    expect(readFileSync(file, 'utf8')).toBe(text)
  })

  it('leaves a non-DeskKnock-written file alone', () => {
    const home = mkdtempSync(join(tmpdir(), 'dk-home-'))
    const text = '[Desktop Entry]\nType=Application\nName=My Knock\nExec=/usr/bin/foo\n'
    const file = writeExisting(home, text)
    ensureAutostart(home, '/opt/DeskKnock/deskknock')
    expect(readFileSync(file, 'utf8')).toBe(text)
  })
})
