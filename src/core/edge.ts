export type Edge = 'bottom-left' | 'bottom-right' | 'left' | 'right';
export interface Rect { x: number; y: number; width: number; height: number }

const EDGES: Edge[] = ['bottom-left', 'bottom-right', 'left', 'right'];

/** Random non-top edge. */
export function pickEdge(rand: () => number = Math.random): Edge {
  const i = Math.min(EDGES.length - 1, Math.max(0, Math.floor(rand() * EDGES.length)));
  return EDGES[i];
}

/** Window rect flush to the given edge/corner of the work area. Side edges sit at 60% height. */
export function overlayBounds(edge: Edge, workArea: Rect, size = { w: 460, h: 320 }): Rect {
  const { w, h } = size;
  const right = workArea.x + workArea.width - w;
  const bottom = workArea.y + workArea.height - h;
  switch (edge) {
    case 'bottom-left': return { x: workArea.x, y: bottom, width: w, height: h };
    case 'bottom-right': return { x: right, y: bottom, width: w, height: h };
    case 'left': return { x: workArea.x, y: workArea.y + Math.round((workArea.height - h) * 0.6), width: w, height: h };
    case 'right': return { x: right, y: workArea.y + Math.round((workArea.height - h) * 0.6), width: w, height: h };
  }
}

/** Random non-top edge, avoiding `exclude` when given. */
export function pickEdgeExcept(exclude: Edge | null, rand: () => number = Math.random): Edge {
  const pool = EDGES.filter((e) => e !== exclude);
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rand() * pool.length)));
  return pool[i];
}
