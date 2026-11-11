# Manual checks (run by Osman)

## Task 1

Run `npm run dev` from `~/Projects/deskknock` (not `/tmp`; it is mounted `nosuid`). Expected: window titled DeskKnock opens. If it fails with the SUID sandbox error, run `sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox` once.

## Task 6

Run two instances on two machines on the office LAN (or one machine plus a second user session); each lists the other within 10 s. If not, note "mDNS blocked" and confirm that a manual IP works.

## Task 7

Add a temporary dev menu item "Test knock from self", which is removed in Task 9. Put Chrome and VS Code each in fullscreen and fire it 4 times. Expected each time: the character appears on top from a random non-top edge, the background is transparent, the chime plays, and **typing continues in the editor with no lost keystrokes** while it animates in.

(The "Test knock from self" item is under the "Dev" menu of the DeskKnock window, `npm run dev`.)

## Task 8

Lock the screen (Super+L) and knock from a second instance → the caller sees `Away`; unlock → the overlay appears. Toggle `Pause knocks` → the caller's button is disabled with `Paused`.

(Needs the Task 9 wiring; the tray icon, its menu and hide-on-close can be checked now with `npm run dev`.)
