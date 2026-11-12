// Art for each character part, keyed by id. Swap the art here without touching logic.
// All shapes are drawn in a 200x200 viewBox, "rise" orientation (hands on the bottom edge).
import type { Character } from '../../core/character';

export interface HeadShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export const FACES: Record<Character['face'], HeadShape> = {
  oval: { cx: 100, cy: 112, rx: 54, ry: 56 },
  round: { cx: 100, cy: 112, rx: 58, ry: 56 },
  square: { cx: 100, cy: 112, rx: 54, ry: 50 },
};

// Hair drawn behind the head (back) and over it (front). Fill is the hair colour.
export const HAIR: Record<Character['hair'], { back?: string; front?: string }> = {
  'short-1': {
    back: 'M40 100 Q40 46 100 46 Q160 46 160 100 Z',
    front: 'M46 98 Q50 52 100 50 Q150 52 154 98 Q130 72 100 74 Q70 72 46 98 Z',
  },
  'short-2': {
    back: 'M38 98 A62 60 0 0 1 162 98 A62 60 0 0 1 38 98 Z',
    front: 'M44 104 Q46 50 100 48 Q156 50 158 102 Q140 76 112 74 Q120 84 108 88 Q90 72 66 84 Q52 92 44 104 Z',
  },
  'long-1': {
    back: 'M36 110 Q34 44 100 44 Q166 44 164 110 L168 190 L32 190 Z',
    front: 'M46 100 Q50 52 100 50 Q150 52 154 100 Q130 70 100 74 Q70 70 46 100 Z',
  },
  'curly-1': {
    back: 'M34 100 Q30 60 56 50 Q70 30 100 38 Q130 30 144 50 Q170 60 166 100 Z',
    front: 'M48 96 Q56 60 100 58 Q144 60 152 96 Q130 78 100 80 Q70 78 48 96 Z',
  },
  bald: {},
};

export const BEARD: Record<Exclude<Character['beard'], 'none'>, { d: string; opacity: number }> = {
  stubble: { d: 'M54 128 Q60 172 100 172 Q140 172 146 128 Q130 150 100 150 Q70 150 54 128 Z', opacity: 0.3 },
  full: { d: 'M50 124 Q56 178 100 180 Q144 178 150 124 Q132 146 100 144 Q68 146 50 124 Z', opacity: 1 },
};

export interface GlassesArt {
  frame: string[]; // element specs rendered by the component
  kind: 'ellipse' | 'rect';
}

export const GLASSES: Record<Exclude<Character['glasses'], 'none'>, GlassesArt> = {
  round: { kind: 'ellipse', frame: ['80 112 15 16', '120 112 15 16'] },
  square: { kind: 'rect', frame: ['65 98 30 28', '105 98 30 28'] },
};

export const SKIN_SHADE = '#00000014';
export const NECK_PATH = 'M58 200 Q60 165 100 162 Q140 165 142 200 Z';
export const EAR_RX = 9;
export const EAR_RY = 13;
export const BROW_PATHS = ['M68 96 Q78 89 88 94', 'M112 94 Q122 89 132 96'];
export const SMILE_PATH = 'M86 140 Q100 154 114 140';
export const HAND_RECTS = [
  { x: 30, y: 176 },
  { x: 126, y: 176 },
];
export const FINGER_LINES = [
  [41, 178, 41, 190], [52, 177, 52, 190], [63, 178, 63, 190],
  [137, 178, 137, 190], [148, 177, 148, 190], [159, 178, 159, 190],
];
