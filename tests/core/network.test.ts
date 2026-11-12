import { describe, it, expect } from 'vitest';
import { listenErrorMessage } from '../../src/core/network';

describe('listenErrorMessage', () => {
  it('port in use → change it in Settings and restart', () => {
    const err = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    expect(listenErrorMessage(47321, err)).toBe("Can't use port 47321 — change it in Settings and restart");
  });
  it('other errors include the code', () => {
    const err = Object.assign(new Error('nope'), { code: 'EACCES' });
    expect(listenErrorMessage(80, err)).toBe("Can't use port 80 (EACCES) — change it in Settings and restart");
  });
  it('non-Error values', () => {
    expect(listenErrorMessage(5000, 'weird')).toBe("Can't use port 5000 — change it in Settings and restart");
  });
});
