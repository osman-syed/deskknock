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

## Task 9

Manual end-to-end (two machines): knock → overlay → `Coming` → the caller sees a `Coming!` peek for 8 s and the row shows `Coming`. Repeat with `Busy · 5 min` and wait 5 min for the reminder. Quit the caller's app mid-knock → the receiver's overlay closes after about 30 s.

Reply peek arrives while an incoming knock is visible → both are visible on different edges; the knock's buttons still work.

(The Task 7 "Dev → Test knock from self" menu item is gone; the window has Electron's default menu again.)

## Task 10

Manual: change the character, and a connected teammate's list and next knock show the new look.

Carried over from Task 9:
- Launch DeskKnock twice → the second launch only focuses the first window (one tray icon).
- Start another program on port 47321 (e.g. `python3 -m http.server 47321`), then launch DeskKnock → banner says it can't use the port; no peers are dialed.
