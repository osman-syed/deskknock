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

## Task 11

Step 3 (needs sudo): `sudo apt install ./dist/deskknock_*.deb`. Run `stat -c '%U %a' /opt/DeskKnock/chrome-sandbox` -> `root 4755`. Launch from the app menu -> it runs without `--no-sandbox`. Log out and back in -> it autostarts to the tray.

Step 5 (second machine): install on one teammate's machine and run Task 9 Step 5 between the two machines.

## Background-first & tray knock

1. Fresh config: quit DeskKnock, then `mv ~/.config/DeskKnock ~/.config/DeskKnock.bak`. Run `setsid -f deskknock --hidden >/dev/null 2>&1` -> no window opens, no character builder opens, the tray icon is present.
2. Random character: tray menu -> `Open DeskKnock` -> Settings -> Edit my character -> a (random) character is shown, not the default one. Close the windows.
3. Repeat step 1 with plain `deskknock` (fresh config again) -> still no window on first run.
4. Tray menu lists teammates (online first, by name) as `Name — Online` / `Offline` / `Paused`...; offline/paused rows are greyed out. With no teammates it shows "No teammates online yet".
5. Click a teammate -> they get the knock; the row shows `Name — Knocking… · Cancel`; clicking it cancels. Knock again and have them reply -> the row updates (`Coming` / `Busy until hh:mm` / `Seen`) within about a second.
6. Log out and back in -> DeskKnock is running in the tray with no window (started by `/etc/xdg/autostart/deskknock.desktop`; no new `~/.config/autostart/deskknock.desktop` is created).
6a. A teammate with a long name or a name containing a newline shows as one line, at most 40 characters ending in `…`, in the tray, window and overlay.
7. `sudo apt remove deskknock` -> `/etc/xdg/autostart/deskknock.desktop` is gone (`ls /etc/xdg/autostart/deskknock.desktop` fails). Restore your config with `mv ~/.config/DeskKnock.bak ~/.config/DeskKnock` if wanted.
