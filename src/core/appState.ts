import type { OutgoingView } from './knockEngine';
import type { PeerView } from './peers';
import type { Settings } from './store';

/** Full state pushed from main to the main window. */
export interface AppState {
  peers: PeerView[];
  outgoing: Record<string, OutgoingView>;
  updateAvailable: string | null;
  settings: Settings;
}
