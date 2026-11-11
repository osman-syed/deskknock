import { isCharacter, type Character } from './character';

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

const ANSWERS: readonly string[] = ['coming', 'busy5', 'dismissed'];
const STATES: readonly string[] = ['shown', 'queued', 'away', 'paused'];

const isStr = (v: unknown): v is string => typeof v === 'string';

export function encode(m: Message): string {
  return JSON.stringify(m);
}

export function decode(raw: string): Message | null {
  try {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    switch (o.t) {
      case 'hello':
        if (
          isStr(o.peerId) && isStr(o.name) && isStr(o.appVersion) &&
          typeof o.protocolVersion === 'number' && Number.isFinite(o.protocolVersion) &&
          isCharacter(o.character) && (o.photoHash === null || isStr(o.photoHash))
        ) {
          return { t: 'hello', peerId: o.peerId, name: o.name, appVersion: o.appVersion, protocolVersion: o.protocolVersion, character: o.character, photoHash: o.photoHash };
        }
        return null;
      case 'presence':
        return typeof o.paused === 'boolean' && typeof o.away === 'boolean'
          ? { t: 'presence', paused: o.paused, away: o.away } : null;
      case 'knock':
        return isStr(o.id) ? { t: 'knock', id: o.id } : null;
      case 'status':
        return isStr(o.id) && isStr(o.state) && STATES.includes(o.state)
          ? { t: 'status', id: o.id, state: o.state as DeliveryState } : null;
      case 'reply':
        return isStr(o.id) && isStr(o.answer) && ANSWERS.includes(o.answer)
          ? { t: 'reply', id: o.id, answer: o.answer as Answer } : null;
      case 'cancel':
        return isStr(o.id) ? { t: 'cancel', id: o.id } : null;
      case 'getPhoto':
        return { t: 'getPhoto' };
      case 'photo':
        return isStr(o.hash) && isStr(o.pngBase64) ? { t: 'photo', hash: o.hash, pngBase64: o.pngBase64 } : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
