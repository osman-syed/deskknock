/** User-facing text for a failed WebSocket listen. Networking stays off until restart. */
export function listenErrorMessage(port: number, err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  const detail = typeof code === 'string' && code !== 'EADDRINUSE' ? ` (${code})` : '';
  return `Can't use port ${port}${detail} — change it in Settings and restart`;
}
