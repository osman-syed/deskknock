# Manual checks (run by Osman)

## Task 1

Run `npm run dev` from `~/Projects/deskknock` (not `/tmp`; it is mounted `nosuid`). Expected: window titled DeskKnock opens. If it fails with the SUID sandbox error, run `sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox` once.

## Task 6

Run two instances on two machines on the office LAN (or one machine plus a second user session); each lists the other within 10 s. If not, note "mDNS blocked" and confirm that a manual IP works.
