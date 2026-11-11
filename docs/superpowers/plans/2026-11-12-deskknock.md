# DeskKnock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Linux desktop app where one click makes your own animated character peek into a teammate's screen ("Hi! Look here 👋 — Osman is calling you") with Coming / Busy · 5 min replies, peer-to-peer on the office LAN.

**Architecture:** Electron app. All decision logic (protocol, knock state machine, peer registry, storage) lives in plain TypeScript modules under `src/core/` with no Electron imports, unit-tested with Vitest. `src/main/` wires them to Electron (windows, tray, DBus, mDNS, WebSocket). `src/renderer/` holds three React UIs (main window, overlay, character builder) sharing one SVG character renderer.

**Tech Stack:** Electron 33, TypeScript 5, electron-vite, React 18, Vitest, `ws`, `bonjour-service`, `dbus-next`, `sharp` (photo resize), electron-builder (.deb).

**Spec:** `docs/superpowers/specs/2026-11-12-deskknock-design.md`. Overlay window reference: `spikes/overlay/main.js`. Pose/animation reference: `docs/superpowers/mockups/peek-character.html`.

## Global Constraints

- Target: Ubuntu 26.04, GNOME on Wayland. Always run under XWayland: `app.commandLine.appendSwitch('ozone-platform', 'x11')` before `app.whenReady()`.
- Never ship or document `--no-sandbox`. The .deb must install `chrome-sandbox` root-owned, mode 4755.
- The overlay window never takes keyboard focus: `focusable: false`, shown with `showInactive()`.
- Overlay window: `transparent: true, frame: false, resizable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true`, then `setAlwaysOnTop(true, 'screen-saver')` and `setVisibleOnAllWorkspaces(true)`; primary display work area.
- mDNS service type `_deskknock._tcp`. Default WebSocket port `47321` (configurable).
- Config dir `~/.config/DeskKnock/`: `settings.json`, `character.json`, `photo.png`, `peers/`.
- Photo ≤128px on its longest side, PNG.
- Timings: knock cooldown 30 s after an answer; "Not answered yet" after 2 min; Busy reminder after 5 min; reply peek auto-hides after 8 s.
- Exact copy: `Hi! Look here 👋`, `<Name> is calling you`, `Coming`, `Busy · 5 min`, `You said 5 min — <Name> is waiting`, `Coming!`, `Busy, ~5 min`, `Knocking…`, `Busy until hh:mm`, `Not answered yet`, `Paused`, `Away`, `Needs update`, `Update available`, `+N more waiting`.
- Overlay edges: `bottom-left | bottom-right | left | right` (never top).
- No GNOME notifications for knocks or replies; DeskKnock overlays only. Knocks ignore GNOME Do Not Disturb.
- Commit messages: no co-author lines.

## Review Focus

1. **Caller's app quits or loses network while their knock is on screen** → receiver's overlay closes after the caller has been offline 30 s; it does not stay forever. (Test: Task 4, `closes incoming knock when caller offline 30s`.)
2. **Garbage, oversized or wrong-version messages from the LAN** → ignored and logged, never crash the main process. Messages over 512 KB rejected. (Test: Task 2, `decode rejects…` cases.)
3. **Reply clicked after the caller restarted** (unknown knock id) → silently dropped on both sides. (Test: Task 4, `reply for unknown id is ignored`.)
4. **Laptop changes IP / Wi-Fi reconnects** → peer goes offline then online again under the same `peerId`, with no duplicate entry in the list. (Test: Task 5, `same peerId from new address replaces old connection`.)
5. **Two teammates with the same display name** → kept apart by `peerId`; both listed. (Test: Task 5, `peers with same name are separate`.)

---

### Task 1: Scaffold and launch

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main/index.html`, `src/renderer/main/main.tsx`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build`; renderer entries keyed `main`, `overlay`, `builder` in `electron.vite.config.ts` (later tasks add the overlay and builder html files).

- [ ] **Step 1:** Scaffold with electron-vite (React + TS template), pin `electron@33`, add `vitest`. Delete template demo content.
- [ ] **Step 2:** Write `tests/smoke.test.ts` asserting `1 + 1 === 2`; run `npm test` → PASS.
- [ ] **Step 3:** In `src/main/index.ts`, append the `ozone-platform=x11` switch before ready; open a 900×600 main window showing "DeskKnock".
- [ ] **Step 4:** Run `npm run dev` from `~/Projects/deskknock` (not `/tmp`; it is mounted `nosuid`). Expected: window titled DeskKnock opens. If it fails with the SUID sandbox error, run `sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox` once.
- [ ] **Step 5:** Commit `chore: scaffold electron-vite app`.

### Task 2: Protocol

**Files:**
- Create: `src/core/protocol.ts`, `tests/core/protocol.test.ts`

**Interfaces:**
- Produces:
```ts
export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 512 * 1024;
export type Answer = 'coming' | 'busy5' | 'dismissed';
export type DeliveryState = 'shown' | 'queued' | 'away' | 'paused';
export type Message =
  | { t: 'hello'; peerId: string; name: string; appVersion: string; protocolVersion: number; character: Character; photoHash: string | null }
  | { t: 'presence'; paused: boolean; away: boolean }
  | { t: 'knock'; id: string }
  | { t: 'status'; id: string; state: DeliveryState }
  | { t: 'reply'; id: string; answer: Answer }
  | { t: 'cancel'; id: string }
  | { t: 'getPhoto' }
  | { t: 'photo'; hash: string; pngBase64: string };
export function encode(m: Message): string;
export function decode(raw: string): Message | null; // null = invalid, never throws
```
- Consumes: `Character`, `isCharacter` from Task 3. Write Task 3's types first if you take this task first, or stub `isCharacter` as `() => true` and replace it in Task 3.

- [ ] **Step 1: Failing tests** in `tests/core/protocol.test.ts`:
  - `round-trips every message type`: `decode(encode(m))` deep-equals `m` for one sample of each `t`.
  - `decode rejects non-JSON` → `null` for `"{oops"`.
  - `decode rejects unknown type` → `null` for `{"t":"explode"}`.
  - `decode rejects missing fields` → `null` for `{"t":"reply","id":"x"}` and `{"t":"reply","id":"x","answer":"maybe"}`.
  - `decode rejects oversized` → `null` for a string of length `MAX_MESSAGE_BYTES + 1`.
  - `decode rejects bad character in hello` → `null` when `character` is `{}`.
- [ ] **Step 2:** Run `npx vitest run tests/core/protocol.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement with hand-written type guards (no schema library).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: wire protocol encode/decode`.

### Task 3: Character model and SVG renderer

**Files:**
- Create: `src/core/character.ts`, `src/renderer/shared/CharacterSvg.tsx`, `src/renderer/shared/parts.ts`, `tests/core/character.test.ts`, `tests/renderer/CharacterSvg.test.tsx`

**Interfaces:**
- Produces:
```ts
// src/core/character.ts
export interface Character {
  face: 'oval' | 'round' | 'square';
  skin: string;            // #rrggbb
  hair: 'short-1' | 'short-2' | 'long-1' | 'curly-1' | 'bald';
  hairColor: string;       // #rrggbb
  glasses: 'none' | 'round' | 'square';
  beard: 'none' | 'stubble' | 'full';
  shirt: string;           // #rrggbb
}
export const DEFAULT_CHARACTER: Character;
export function isCharacter(x: unknown): x is Character;
// src/renderer/shared/CharacterSvg.tsx
export type Pose = 'rise' | 'lean';
export function CharacterSvg(props: { character: Character; pose: Pose; animate: boolean }): JSX.Element;
```
- Part shapes: start from the spike SVG (`spikes/overlay/overlay.html`) for `oval` + `short-2` and the hands-on-edge pose; the other variants are placeholders of the same style. The final art is a separate design job (spec "Left to the builder"). Keep every part in `parts.ts` keyed by id so the art can be swapped without touching logic.
- `lean` is the `rise` drawing rotated −90° (as in the mockup); the hands stay on the screen edge.

- [ ] **Step 1: Failing tests:**
  - `isCharacter accepts DEFAULT_CHARACTER`; `rejects bad colour` (`skin: 'red'`); `rejects unknown hair id`; `rejects extra-long strings`.
  - `CharacterSvg renders skin colour`: render with `skin: '#123456'` (Vitest + `@testing-library/react`, jsdom) and assert the head element's `fill` is `#123456`.
  - `CharacterSvg omits glasses when none`: no element with `data-part="glasses"`.
  - `CharacterSvg lean pose rotates`: root `<g>` has `transform` containing `rotate(-90`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Blink and eye-glance animations are CSS keyframes applied when `animate` is true (timings from the mockup).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: character model and svg renderer`.

### Task 4: Knock engine (state machine)

**Files:**
- Create: `src/core/knockEngine.ts`, `tests/core/knockEngine.test.ts`

**Interfaces:**
- Consumes: `Answer`, `DeliveryState`, `Message` (Task 2).
- Produces:
```ts
export type OutgoingView =
  | { kind: 'idle'; canKnock: boolean }   // false during 30s cooldown, or peer paused/offline
  | { kind: 'knocking' } | { kind: 'shown' } | { kind: 'queued' }
  | { kind: 'away' } | { kind: 'paused' } | { kind: 'not-answered' }
  | { kind: 'coming' } | { kind: 'busy'; until: number } | { kind: 'dismissed' };
export interface IncomingKnock { id: string; fromPeerId: string; reminder: boolean }
export interface EngineEffects {
  send(peerId: string, m: Message): void;
  showIncoming(k: IncomingKnock, waitingBehind: number): void; // overlay; waitingBehind drives "+N more waiting"
  hideIncoming(id: string): void;
  showReply(fromPeerId: string, answer: 'coming' | 'busy5'): void; // 8s reply peek on caller's screen
  outgoingChanged(peerId: string, view: OutgoingView): void;
}
export class KnockEngine {
  constructor(fx: EngineEffects, now: () => number = Date.now, newId: () => string = randomUUID);
  // caller side
  knock(peerId: string): boolean;          // false if blocked (anti-spam, cooldown, paused, offline)
  cancel(peerId: string): void;
  // receiver side
  answer(id: string, a: Answer): void;
  setLocked(locked: boolean): void;
  setPaused(paused: boolean): void;
  // network
  onMessage(fromPeerId: string, m: Message): void;
  peerOnline(peerId: string, online: boolean): void;
  peerPresence(peerId: string, p: { paused: boolean; away: boolean }): void;
  tick(): void;                            // call every second from main; drives timers
}
```
- Timers are driven by `tick()` + injected `now()` so tests need no fake timers.

- [ ] **Step 1: Failing tests** (fake `EngineEffects` recording calls; `now` is a mutable number):
  - `knock sends knock and shows Knocking…` → `send(B,{t:'knock'})`, view `knocking`.
  - `second knock while unanswered is refused` → `knock(B)` returns `false`, one `send`.
  - `status updates view` → on `{t:'status',state:'queued'}` view is `queued`; same for `away`, `shown`.
  - `not answered after 2 min` → after `now += 120_000; tick()` view is `not-answered`; at 119_999 it is still `shown`.
  - `reply coming shows reply peek and view` → `showReply(B,'coming')`, view `coming`.
  - `reply busy5 sets until` → view `busy`, `until === now + 300_000`.
  - `cooldown 30s after answer` → `knock(B)` false at +29_999 ms, true at +30_000 ms.
  - `cannot knock paused peer` → after `peerPresence(B,{paused:true,away:false})`, `knock(B)` false, view `paused`.
  - `cancel sends cancel` → `send(B,{t:'cancel'})`; view idle.
  - `incoming knock is shown and status shown sent` → `showIncoming`, `send(A,{t:'status',state:'shown'})`.
  - `incoming while locked is queued as away and shown on unlock` → `status away`, no `showIncoming`; after `setLocked(false)` → `showIncoming` + `status shown`.
  - `incoming while paused is refused` → `status paused`, no `showIncoming`.
  - `second caller is queued with +1` → second knock not shown; first `showIncoming` call re-issued with `waitingBehind = 1`; after answering first, second is shown with `waitingBehind = 0`.
  - `answer coming sends reply and hides` → `send(A,{t:'reply',answer:'coming'})`, `hideIncoming`.
  - `busy5 reminder after 5 min` → after `answer(id,'busy5')` and `now += 300_000; tick()`, `showIncoming({..., reminder:true})` from the same caller.
  - `caller cancel hides overlay` → on `{t:'cancel',id}` → `hideIncoming(id)`.
  - `closes incoming knock when caller offline 30s` → `peerOnline(A,false)`; at +29_999 still shown; at +30_000 `hideIncoming`; coming back online before then keeps it.
  - `reply for unknown id is ignored` → `onMessage(B,{t:'reply',id:'nope',answer:'coming'})` produces no effects; `answer('nope','coming')` produces no effects.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement as a single class with two maps (`outgoing: Map<peerId, …>`, `incoming: queue`). No Electron imports.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: knock engine state machine`.

### Task 5: Storage, peer registry and transport

**Files:**
- Create: `src/core/store.ts`, `src/core/peers.ts`, `src/main/transport.ts`, `tests/core/store.test.ts`, `tests/core/peers.test.ts`, `tests/main/transport.test.ts`

**Interfaces:**
- Consumes: `Message`, `encode`, `decode`, `PROTOCOL_VERSION` (Task 2); `Character`, `DEFAULT_CHARACTER`, `isCharacter` (Task 3).
- Produces:
```ts
// store.ts — dir injected so tests use a temp dir
export interface Settings { peerId: string; name: string; muted: boolean; paused: boolean; port: number; manualPeers: string[] /* "ip[:port]" */ }
export class Store {
  constructor(dir: string);
  loadSettings(): Settings;           // creates peerId (uuid) + defaults on first run; port 47321
  saveSettings(s: Settings): void;
  loadCharacter(): Character;         // DEFAULT_CHARACTER if missing/invalid
  saveCharacter(c: Character): void;
  loadPhoto(): { png: Buffer; hash: string } | null; // hash = sha256 hex
  savePhoto(png: Buffer): void;       // caller already resized to ≤128px
  cachePeer(p: PeerProfile): void; loadCachedPeers(): PeerProfile[]; cachePeerPhoto(hash: string, png: Buffer): void; loadPeerPhoto(hash: string): Buffer | null;
}
// peers.ts
export interface PeerProfile { peerId: string; name: string; appVersion: string; protocolVersion: number; character: Character; photoHash: string | null }
export interface PeerView extends PeerProfile { online: boolean; compatible: boolean; paused: boolean; away: boolean }
export class PeerRegistry extends EventEmitter { // emits 'changed'
  upsertFromHello(hello: Extract<Message,{t:'hello'}>): void;
  setOnline(peerId: string, online: boolean): void;
  setPresence(peerId: string, p: { paused: boolean; away: boolean }): void;
  list(): PeerView[];                 // sorted: online first, then name
  newerAppVersionSeen(mine: string): string | null; // drives "Update available"
}
// transport.ts
export class Transport extends EventEmitter { // events: 'message'(peerId, Message), 'online'(peerId, boolean)
  constructor(opts: { port: number; hello: () => Extract<Message,{t:'hello'}> });
  listen(): Promise<void>;
  connect(host: string, port: number): void; // dedup by peerId after hello
  send(peerId: string, m: Message): void;    // no-op if not connected
  close(): Promise<void>;
}
```
- Connection rule: both sides send `hello` on open; a socket becomes "peer X" only after a valid hello. If a second socket arrives for an existing `peerId`, keep the newest and close the old. If both peers dial each other at once, the side with the lower `peerId` keeps its outgoing socket. Invalid messages (`decode` → `null`) are logged and dropped. Ping every 10 s; no pong in 20 s → close → `online false`.
- Photo: after hello, if `photoHash` is not cached, send `getPhoto`; on `photo`, verify the sha256 matches the hash, then cache it.

- [ ] **Step 1: Failing tests:**
  - store: `first run creates peerId and port 47321`; `peerId stable across loads`; `invalid character.json falls back to default`; `photo hash is sha256 of png`.
  - peers: `incompatible protocolVersion is marked compatible:false`; `peers with same name are separate`; `newerAppVersionSeen returns highest semver above mine` (`'1.2.0'` vs peers `1.1.0`, `1.3.0` → `'1.3.0'`).
  - transport (two `Transport`s on `127.0.0.1` with ports 0/random): `hello exchange emits online on both`; `send delivers message`; `same peerId from new address replaces old connection` (one `online true`, no duplicate, old socket closed); `invalid json is dropped and connection survives`; `close emits online false on the other side`; `photo fetched once and hash-verified`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `ws`. `transport.ts` may import Node but not Electron.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: storage, peer registry and websocket transport`.

### Task 6: Discovery

**Files:**
- Create: `src/main/discovery.ts`, `tests/main/discovery.test.ts`

**Interfaces:**
- Consumes: `Transport.connect` (Task 5).
- Produces:
```ts
export class Discovery {
  constructor(opts: { peerId: string; name: string; port: number; connect: (host: string, port: number) => void; bonjour?: BonjourLike });
  start(): void;                       // publish _deskknock._tcp with txt {peerId}, browse, connect on 'up'
  setManualPeers(list: string[]): void; // "ip" or "ip:port"; connect now and retry every 30s while not connected
  stop(): void;
}
export function parseManualPeer(s: string): { host: string; port: number } | null; // default port 47321
```

- [ ] **Step 1: Failing tests:** `parseManualPeer('10.0.0.5')` → `{host:'10.0.0.5',port:47321}`; `'10.0.0.5:5000'` → port 5000; `'nonsense:x'` → `null`; `ignores own service` (fake BonjourLike emits an `up` with own `peerId` → `connect` not called); `connects to discovered peer` (fake `up` with another `peerId`, address `10.0.0.9`, port 47321 → `connect('10.0.0.9',47321)`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with `bonjour-service`. **Step 4:** Run → PASS.
- [ ] **Step 5: Manual check:** run two instances on two machines on the office LAN (or one machine plus a second user session); each lists the other within 10 s. If not, note "mDNS blocked" and confirm that a manual IP works.
- [ ] **Step 6:** Commit `feat: mdns and manual peer discovery`.

### Task 7: Overlay (knock, reminder, reply peek) and chime

**Files:**
- Create: `src/main/overlay.ts`, `src/renderer/overlay/index.html`, `src/renderer/overlay/Overlay.tsx`, `src/core/edge.ts`, `resources/chime.ogg`, `tests/core/edge.test.ts`, `tests/renderer/Overlay.test.tsx`
- Modify: `src/preload/index.ts` (overlay API)

**Interfaces:**
- Consumes: `CharacterSvg` (Task 3); `IncomingKnock`, `EngineEffects.showIncoming/hideIncoming/showReply` (Task 4).
- Produces:
```ts
// edge.ts
export type Edge = 'bottom-left' | 'bottom-right' | 'left' | 'right';
export function pickEdge(rand: () => number = Math.random): Edge;
export function overlayBounds(edge: Edge, workArea: Rect, size = { w: 460, h: 320 }): Rect; // flush to that edge/corner
// overlay.ts (Electron)
export class OverlayManager {
  showKnock(p: { id: string; caller: PeerView; photo: Buffer | null; reminder: boolean; waitingBehind: number; muted: boolean }): void;
  hide(id: string): void;
  showReply(p: { from: PeerView; answer: 'coming' | 'busy5' }): void; // auto-hide 8s, no buttons, no chime
  onAnswer(cb: (id: string, a: Answer) => void): void;
}
// preload: window.overlay = { onShow(cb), answer(id, a) }
```
- Bubble copy (exact): knock → small `Hi! Look here 👋` + `<b>{name}</b> is calling you`; reminder → `You said 5 min — {name} is waiting`; reply → `Coming!` or `Busy, ~5 min`; queue → `+{n} more waiting` when n>0. Buttons: `Coming`, `Busy · 5 min`, and a small × (answer `dismissed`). Optional round photo (≤32px) before the name.
- The bubble sits on the side of the character facing the screen centre. Pose `rise` for the bottom corners, `lean` for left and right (mirror horizontally for `left`).
- The chime plays in the overlay renderer via `<audio>` when shown, unless `muted`. Pick a short (<1 s), soft sound with a CC0 or bundled licence and note its source in `resources/README.md`.
- Window flags are exactly as in Global Constraints. One window per visible overlay; queued knocks reuse it.

- [ ] **Step 1: Failing tests:**
  - edge: `pickEdge never returns top` (rand values 0, 0.25, 0.5, 0.75, 0.999 → all within the 4 edges); `overlayBounds bottom-right is flush` (`x + w === wa.x + wa.width`, `y + h === wa.y + wa.height`); `left is flush to left` (`x === wa.x`).
  - Overlay (jsdom): `shows caller name and both buttons`; `reminder copy`; `+2 more waiting when waitingBehind 2`; `clicking Busy · 5 min calls answer(id,'busy5')`; `× calls answer(id,'dismissed')`; `reply mode has no buttons and shows Coming!`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Manual check (on Osman's machine):** add a temporary dev menu item "Test knock from self", which is removed in Task 9. Put Chrome and VS Code each in fullscreen and fire it 4 times. Expected each time: the character appears on top from a random non-top edge, the background is transparent, the chime plays, and **typing continues in the editor with no lost keystrokes** while it animates in.
- [ ] **Step 6:** Commit `feat: overlay window with knock, reminder and reply peek`.

### Task 8: Lock detection, pause, tray, autostart

**Files:**
- Create: `src/main/lockWatcher.ts`, `src/main/tray.ts`, `src/main/autostart.ts`, `resources/deskknock.desktop`, `tests/main/autostart.test.ts`

**Interfaces:**
- Consumes: `KnockEngine.setLocked/setPaused` (Task 4); `Store` (Task 5).
- Produces:
```ts
export function watchScreenLock(cb: (locked: boolean) => void): Promise<() => void>; // DBus session bus, org.gnome.ScreenSaver ActiveChanged via dbus-next
export function createTray(opts: { onOpen(): void; onTogglePause(paused: boolean): void; onQuit(): void; paused: boolean }): Tray;
export function ensureAutostart(homeDir: string, execPath: string): void; // writes ~/.config/autostart/deskknock.desktop if absent
```
- Tray menu: `Open DeskKnock`, a checkbox `Pause knocks`, `Quit`. Closing the main window hides it, and the app keeps running. Pause state persists in `Settings.paused` and is broadcast as `presence`.

- [ ] **Step 1: Failing test:** `ensureAutostart writes desktop file once` (temp home → file exists with `Exec=` containing execPath; second call leaves mtime unchanged).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Manual check:** lock the screen (Super+L) and knock from a second instance → the caller sees `Away`; unlock → the overlay appears. Toggle `Pause knocks` → the caller's button is disabled with `Paused`.
- [ ] **Step 6:** Commit `feat: screen lock, pause, tray and autostart`.

### Task 9: Main window and app wiring

**Files:**
- Modify: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/main/App.tsx`, `src/renderer/main/PeerRow.tsx`, `src/renderer/main/Settings.tsx`, `src/core/statusText.ts`, `tests/core/statusText.test.ts`, `tests/renderer/App.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
```ts
export function statusText(v: OutgoingView, peer: PeerView, nowMs: number): { label: string; knockEnabled: boolean };
// preload: window.deskknock = { onState(cb: (s: { peers: PeerView[]; outgoing: Record<string, OutgoingView>; updateAvailable: string | null; settings: Settings }) => void); knock(peerId); cancel(peerId); saveSettings(s); }
```
- `index.ts` builds Store → Transport → PeerRegistry → Discovery → KnockEngine (effects call Transport.send / OverlayManager / push state to the main window) → LockWatcher → Tray, ticks the engine every 1 s, and sends `presence` on pause/lock changes. Remove the Task 7 dev menu item.
- Peer row: head-only `CharacterSvg` (static), name, online dot, status label, `Knock` button (or `Cancel` while knocking). Settings: display name, mute chime, port, manual peers (one per line). An `Update available` hint appears in the header when `updateAvailable`.

- [ ] **Step 1: Failing tests:**
  - statusText: offline → `knockEnabled:false`; incompatible → label `Needs update`, disabled; paused peer → `Paused`, disabled; `knocking` → `Knocking…`; `not-answered` → `Not answered yet`; `busy` with until 14:05 local → `Busy until 14:05`; `away` → `Away`; `dismissed` → `Seen`; idle during cooldown → disabled.
  - App (jsdom, fake `window.deskknock`): `renders a row per peer, online first`; `clicking Knock calls knock(peerId)`; `shows Update available when set`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Manual end-to-end** (two machines): knock → overlay → `Coming` → the caller sees a `Coming!` peek for 8 s and the row shows `Coming`. Repeat with `Busy · 5 min` and wait 5 min for the reminder. Quit the caller's app mid-knock → the receiver's overlay closes after about 30 s.
- [ ] **Step 6:** Commit `feat: main window and app wiring`.

### Task 10: Character builder

**Files:**
- Create: `src/renderer/builder/index.html`, `src/renderer/builder/Builder.tsx`, `src/main/photo.ts`, `tests/renderer/Builder.test.tsx`, `tests/main/photo.test.ts`
- Modify: `src/main/index.ts` (open the builder on first run and from Settings), `src/preload/index.ts`

**Interfaces:**
- Consumes: `Character`, `CharacterSvg` (Task 3); `Store.saveCharacter/savePhoto` (Task 5).
- Produces: `export async function resizePhoto(input: Buffer): Promise<Buffer>; // sharp → PNG, longest side ≤128`; preload `window.builder = { load(), save(c: Character, photo: Buffer | null) }`.
- Layout: a live preview (animated `rise` pose) on the left; controls on the right for face, skin, hair, hair colour, glasses, beard and shirt colour, plus an optional photo picker; Save. After a save, a fresh `hello` goes to all connected peers so their copy updates.

- [ ] **Step 1: Failing tests:** `resizePhoto 1024x512 → 128x64 PNG`; `resizePhoto rejects non-image` (throws); Builder `changing skin updates preview fill`; `Save calls builder.save with current character`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Manual:** change the character, and a connected teammate's list and next knock show the new look.
- [ ] **Step 6:** Commit `feat: character builder with optional photo`.

### Task 11: .deb packaging

**Files:**
- Create: `electron-builder.yml`, `build/after-install.sh`, `docs/INSTALL.md`

**Interfaces:**
- Produces: `npm run dist` → `dist/deskknock_<version>_amd64.deb`.

- [ ] **Step 1:** Configure the electron-builder `linux.target: deb`, the app id `com.deskknock.app`, the product name `DeskKnock`, and an `after-install.sh` that runs `chown root:root` and `chmod 4755` on `/opt/DeskKnock/chrome-sandbox`. Pass the x11 ozone switch from code (Task 1), not as a launcher flag.
- [ ] **Step 2:** Run `npm run dist` → the .deb exists.
- [ ] **Step 3:** Install it: `sudo apt install ./dist/deskknock_*.deb`. Run `stat -c '%U %a' /opt/DeskKnock/chrome-sandbox` → `root 4755`. Launch from the app menu → it runs without `--no-sandbox`. Log out and back in → it autostarts to the tray.
- [ ] **Step 4:** Write `docs/INSTALL.md`: the install command; the firewall line `sudo ufw allow 47321/tcp` (only if ufw is active); how to add a manual peer IP when discovery fails; and how to update (install the newer .deb over the old one).
- [ ] **Step 5: Second-machine check:** install on one teammate's machine and run Task 9 Step 5 between the two machines.
- [ ] **Step 6:** Commit `build: deb packaging and install guide`.
