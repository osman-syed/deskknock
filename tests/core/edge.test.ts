import { describe, it, expect } from 'vitest';
import { pickEdge, overlayBounds, type Edge } from '../../src/core/edge';

const wa = { x: 10, y: 20, width: 1920, height: 1040 };
const EDGES: Edge[] = ['bottom-left', 'bottom-right', 'left', 'right'];

describe('edge', () => {
  it('pickEdge never returns top', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) expect(EDGES).toContain(pickEdge(() => r));
  });
  it('overlayBounds bottom-right is flush', () => {
    const b = overlayBounds('bottom-right', wa);
    expect(b.x + b.width).toBe(wa.x + wa.width);
    expect(b.y + b.height).toBe(wa.y + wa.height);
  });
  it('left is flush to left', () => {
    expect(overlayBounds('left', wa).x).toBe(wa.x);
  });
  it('right is flush to right and bottom-left to the bottom-left corner', () => {
    const r = overlayBounds('right', wa);
    expect(r.x + r.width).toBe(wa.x + wa.width);
    const bl = overlayBounds('bottom-left', wa);
    expect(bl.x).toBe(wa.x);
    expect(bl.y + bl.height).toBe(wa.y + wa.height);
  });
});
