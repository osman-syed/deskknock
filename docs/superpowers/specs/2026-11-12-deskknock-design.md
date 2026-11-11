# DeskKnock — Design

## Why

On Osman's team almost everyone works with headphones on and deep in their editor. Teams chat messages go unseen because nobody is looking at the Teams window. Walking over or shouting breaks everyone's focus. DeskKnock is the digital version of knocking on a colleague's desk: one click, and the colleague's own character peeks into the corner of their screen saying "Hi! Look here 👋 — Osman is calling you", with a soft chime in their headphones.

**Success:** a teammate notices a knock within seconds, even in a fullscreen app, and the caller knows whether they're coming without any back-and-forth.

## Goals (v1)

1. **Knock.** Open DeskKnock, see the teammates who are online, click one to knock on them.
2. **Peeking character.** On the receiver's screen, the *caller's* character peeks in from a screen edge with a short bounce. A speech bubble says "Hi! Look here 👋" / "**<Caller>** is calling you". It sits above everything, including fullscreen apps.
3. **Chime.** A soft sound plays when the character appears. On by default; the receiver can mute it in settings.
4. **Reply.** The bubble has two buttons: **Coming** and **Busy · 5 min**. The reply goes back to the caller, who sees it as a small notification from DeskKnock.
5. **Own character.** Each person builds their character from preset parts (face shape, skin tone, hair style and colour, glasses, beard, shirt colour). An optional small round profile photo appears in the speech bubble next to the name.
6. **No server.** Apps on the same office network find each other automatically and share characters directly.

## Non-goals (v1)

- Chat, voice, video, file sharing.
- Windows or macOS (team is all Linux today).
- Working across the internet or over VPN between sites; same local network only.
- Accounts, logins, admin panel.
- Knocking on several people at once.

## Anti-goals (would make it a failure even if it works)

- **It steals focus.** The overlay must never take keyboard focus; someone mid-typing must not have keystrokes swallowed or sent to the bubble.
- **It looks cheap.** Raw or mismatched visuals. All characters share one polished art style.
- **It becomes a nuisance.** Repeated knocks spamming someone's screen.
- **It appears behind other windows.** Then it's useless.

## Decided by Osman

- Peeking human character + speech bubble, from any screen edge/corner (mockups: character rising from bottom with hands on the edge; leaning in from the side).
- Each teammate has their own character.
- Reply buttons: Coming, Busy · 5 min.
- Characters built from preset parts (Claude's suggestion, Osman agreed).
- No central server; characters live on each person's machine and are shared over the network (Claude's suggestion, Osman agreed).
- Chime on by default with mute (Claude's suggestion, not objected to).
- TypeScript + Electron (Claude's suggestion, Osman agreed).
- Name: DeskKnock.

## Platform constraints and spike findings

Target: Ubuntu 26.04, GNOME on Wayland (Osman's machine; assume the same for the team).

A throwaway spike (Electron 33) on Osman's machine confirmed:

- With `app.commandLine.appendSwitch('ozone-platform', 'x11')` (run under XWayland), a frameless, `transparent: true`, `alwaysOnTop` window at level `'screen-saver'`, shown with `showInactive()` and `focusable: false`:
  - appears **above a fullscreen browser**,
  - has a **truly transparent** background,
  - lands at the **requested position** (bottom-right of the work area),
  - **buttons are clickable** and the reply reaches the main process over IPC.
- Electron's setuid sandbox **fails when run from a `nosuid` mount** (e.g. `/tmp`). The packaged app must install `chrome-sandbox` as root-owned mode 4755 (or ship an AppArmor profile, as Ubuntu 24.04+ restricts unprivileged user namespaces). Do **not** ship with `--no-sandbox`.
- The fullscreen app in the test was **Google Chrome running natively on Wayland** (verified: Chrome had no XWayland windows) in F11 fullscreen. So an XWayland always-on-top overlay *does* sit above a native-Wayland fullscreen window on this Mutter version.
- Native Wayland mode for the overlay itself was not tested; don't rely on it.
- Spike code: `spikes/overlay/` (throwaway, reference for window config). Mockup with pose reference: `docs/superpowers/mockups/peek-character.html`.

## How it works (Claude's calls unless noted)

### Processes and windows
- **Main process**: networking, discovery, settings, tray icon.
- **Main window**: teammate list (character head, name, online dot); a "Knock" action on each; settings; character builder.
- **Overlay window**: created per incoming knock, configured exactly as in the spike. Covers only the area the character + bubble need, in the chosen corner.
- **Tray icon**: app keeps running when the main window is closed. Autostart on login (Claude's call).

### Character
- A character is **data, not an image**: a small JSON object of part IDs and colours, e.g. `{ "face": "oval", "skin": "#e8b58f", "hair": "short-2", "hairColor": "#2b1d16", "glasses": "round", "beard": null, "shirt": "#3b6fe0" }`. Rendered as layered SVG in a fixed art style.
- Same parts render in every pose (rising from bottom, leaning in from side) so any combination animates correctly.
- Idle animation while waiting: blink, eyes glancing toward the bubble.
- Optional profile photo: small (resized to ≤128px) image stored alongside the character; shown in the bubble only.
- **Art quality:** the spike's hand-coded SVG is a placeholder. The final art set (parts library) needs to be properly designed — see "Left to the builder".

### Overlay behaviour
- Edge/corner chosen at random per knock from: bottom-left, bottom-right, right side, left side (Claude's call; top edge omitted because the character's hands-on-edge pose reads oddly upside-down).
- Bubble copy: "Hi! Look here 👋" (small) + "**<Caller>** is calling you".
- **Stays until answered** (Claude's guess, Osman didn't object). Escape hatch: a small × to dismiss without replying (counts as "seen").
- **Busy · 5 min** (Claude's guess): caller is told "Busy, ~5 min". After 5 minutes the receiver gets a gentle reminder bubble ("You said 5 min — Osman is waiting") with Coming / Busy · 5 min again.
- **Coming**: caller is told "<Name> is coming".
- **How the caller sees the reply** (Claude's call): *not* a GNOME notification (GNOME suppresses those in fullscreen and Do Not Disturb). Instead the callee's character peeks into the caller's screen with a short bubble ("Coming!" / "Busy, ~5 min"), auto-hiding after 8 seconds, no buttons. The main window also shows the knock's live state per teammate (Knocking… / Coming / Busy until hh:mm / Not answered).
- **Do Not Disturb** (Claude's call): knocks ignore GNOME DND; getting through to focused people is the point of the app. A per-user "Pause knocks" toggle in the tray (e.g. during meetings/screen-share) makes the caller see "Paused" and blocks knocking.
- **Locked screen / away** (Claude's call): if the receiver's screen is locked, the knock is queued and shown on unlock; the caller sees "Away".
- **No answer** (Claude's call): after 2 minutes unanswered, the caller's status shows "Not answered yet" and they can cancel. The receiver's overlay stays until answered or cancelled. Protocol adds `status {id, state: shown|queued|away|paused}`.
- **Anti-spam:** while a knock from A to B is unanswered, further knocks from A to B are ignored (button shows "Knocking…"). Max one new knock from the same caller per 30 seconds after an answer.
- **Multiple callers at once:** show one at a time, queued, with "+1 more waiting" on the bubble.
- If the receiver is on multiple monitors: show on the primary display (Claude's call).

### Discovery and networking
- **Discovery: mDNS/DNS-SD** (service type `_deskknock._tcp`), advertising display name and a stable random peer ID (generated on first run).
- **Transport:** each app runs a small WebSocket server on a fixed default port (configurable). Peers connect directly.
- On connect, peers exchange profile: name, character JSON, character version, photo hash. Photo fetched only if hash changed. Profiles cached locally so a teammate's character shows even before they reconnect.
- **Messages:** `hello` (profile), `knock {id}`, `reply {id, answer: coming|busy5|dismissed}`, `cancel {id}` (caller withdrew).
- **Online status** = currently has a live connection.
- **Security (v1):** LAN-only, no authentication. Anyone on the office network running DeskKnock can knock. Accepted for v1 given the setting.

### Storage
- `~/.config/DeskKnock/`: `settings.json` (name, mute, port), `character.json`, `photo.png`, `peers/` cache.

### Packaging
- `.deb` built with electron-builder, installing the sandbox helper correctly and an autostart entry; launches with the x11 ozone switch.
- **Install** (decided by Osman): every teammate has sudo and installs the `.deb` themselves (`sudo apt install ./deskknock_x.y.z.deb`). No IT involvement.
- **Updates** (Claude's call): no auto-updater in v1. New `.deb` files are shared by hand. The `hello` message carries app version and protocol version; peers with an incompatible protocol version show as "Needs update" in the list and can't be knocked, and a peer that sees a newer app version on the network shows a small "Update available" hint.

## Left to the builder

- The character parts library and art direction: consistent, professional, friendly; must look good at ~150px and animate (rise, lean, blink, glance). Spike SVG is a reference for the pose only.
- Chime sound choice (short, soft, not alarming).
- Main window and character-builder layout.
- Exact animation timings and easing (spike used ~1.1s rise with slight overshoot, bubble pop at 1s).
- Library choices (mDNS, WebSocket, build tooling) and test approach.

## Open risks

- **mDNS blocked on office network** (some managed Wi-Fi/switches drop multicast). Mitigation: allow manually adding a peer by IP in settings.
- **Firewall** (ufw) may block the WebSocket port; installer or first-run should explain.
- Other GNOME/Wayland setups on the team may differ from Osman's; first build should be tried on a second teammate's machine early.
