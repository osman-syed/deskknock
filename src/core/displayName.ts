export const MAX_DISPLAY_NAME = 40;

// C0 controls + DEL, and bidi embedding/override/isolate controls.
const UNSAFE = /[\u0000-\u001f\u007f‪-‮⁦-⁩]+/g;

/** Peer names are untrusted and unbounded: make one safe and short enough to show in the UI. */
export function displayName(name: string): string {
  // Cut very long input early (with slack for whitespace collapsing) so we never scan megabytes.
  const s = String(name).slice(0, MAX_DISPLAY_NAME * 8).replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return 'Unnamed';
  const chars = [...s];
  return chars.length <= MAX_DISPLAY_NAME ? s : chars.slice(0, MAX_DISPLAY_NAME - 1).join('') + '…';
}
