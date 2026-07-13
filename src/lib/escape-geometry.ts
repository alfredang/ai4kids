/**
 * Pure geometry for the navigable escape-room maps. Turns a `RoomLayout`
 * (rooms on a grid + doors) into pixel floor rects, collision walls (with
 * doorway gaps between connected rooms) and a spawn point. No React / DOM here
 * so it stays unit-testable. The player component handles movement, world-object
 * placement and interaction on top of this.
 */
import type { RoomLayout } from "./escape-rooms";

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type RoomGeometry = {
  /** Play area in px (origin top-left). */
  area: Rect;
  /** Unit grid-cell size in px. */
  cell: { w: number; h: number };
  /** Room id → floor rectangle. */
  floors: Record<string, Rect>;
  /** Axis-aligned collision rectangles (outer border + inter-room walls). */
  walls: Rect[];
  /** Where the character starts (centre of the spawn room). */
  spawn: Point;
};

export function centerOf(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Which room (floor rect) contains a point, or null in a wall/void. */
export function roomAt(geo: RoomGeometry, p: Point): string | null {
  for (const [id, r] of Object.entries(geo.floors)) {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return id;
  }
  return null;
}

export function buildGeometry(
  layout: RoomLayout,
  area: { w: number; h: number },
  opts?: { wall?: number; doorFrac?: number },
): RoomGeometry {
  const t = opts?.wall ?? 10; // wall thickness
  const doorFrac = opts?.doorFrac ?? 0.5; // fraction of an edge left open as a doorway
  const cw = area.w / layout.cols;
  const ch = area.h / layout.rows;

  // Map every unit grid-cell to the room that owns it.
  const owner = new Map<string, string>();
  for (const c of layout.cells) {
    const gw = c.gw ?? 1;
    const gh = c.gh ?? 1;
    for (let dx = 0; dx < gw; dx++) {
      for (let dy = 0; dy < gh; dy++) owner.set(`${c.gx + dx},${c.gy + dy}`, c.id);
    }
  }

  const floors: Record<string, Rect> = {};
  for (const c of layout.cells) {
    floors[c.id] = { x: c.gx * cw, y: c.gy * ch, w: (c.gw ?? 1) * cw, h: (c.gh ?? 1) * ch };
  }

  // One centred doorway per connected pair, spanning the middle `doorFrac` of
  // their (possibly multi-cell) shared boundary — so a door between two wide
  // rooms opens in the middle, not off to one side.
  type Opening = { vertical: boolean; line: number; lo: number; hi: number };
  const openings: Opening[] = [];
  for (const [a, b] of layout.doors) {
    const between = (p?: string, q?: string) => (p === a && q === b) || (p === b && q === a);
    let line = -1;
    const idx: number[] = [];
    // shared vertical boundary (a single column line)
    for (let gx = 0; gx <= layout.cols && line < 0; gx++) {
      const hits: number[] = [];
      for (let gy = 0; gy < layout.rows; gy++) {
        if (between(owner.get(`${gx - 1},${gy}`), owner.get(`${gx},${gy}`))) hits.push(gy);
      }
      if (hits.length) {
        line = gx;
        idx.push(...hits);
      }
    }
    if (line >= 0) {
      const lo = Math.min(...idx) * ch;
      const hi = (Math.max(...idx) + 1) * ch;
      const mid = (lo + hi) / 2;
      const half = ((hi - lo) * doorFrac) / 2;
      openings.push({ vertical: true, line: line * cw, lo: mid - half, hi: mid + half });
      continue;
    }
    // shared horizontal boundary (a single row line)
    for (let gy = 0; gy <= layout.rows && line < 0; gy++) {
      const hits: number[] = [];
      for (let gx = 0; gx < layout.cols; gx++) {
        if (between(owner.get(`${gx},${gy - 1}`), owner.get(`${gx},${gy}`))) hits.push(gx);
      }
      if (hits.length) {
        line = gy;
        idx.push(...hits);
        const lo = Math.min(...idx) * cw;
        const hi = (Math.max(...idx) + 1) * cw;
        const mid = (lo + hi) / 2;
        const half = ((hi - lo) * doorFrac) / 2;
        openings.push({ vertical: false, line: gy * ch, lo: mid - half, hi: mid + half });
      }
    }
  }

  const walls: Rect[] = [];
  // Emit a wall segment along a gridline, carving out any doorway opening on it.
  const emitV = (x: number, y0: number, y1: number) => {
    const op = openings.find((o) => o.vertical && Math.abs(o.line - x) < 0.5 && o.lo < y1 && o.hi > y0);
    if (!op) return void walls.push({ x: x - t / 2, y: y0, w: t, h: y1 - y0 });
    if (op.lo > y0) walls.push({ x: x - t / 2, y: y0, w: t, h: op.lo - y0 });
    if (op.hi < y1) walls.push({ x: x - t / 2, y: op.hi, w: t, h: y1 - op.hi });
  };
  const emitH = (y: number, x0: number, x1: number) => {
    const op = openings.find((o) => !o.vertical && Math.abs(o.line - y) < 0.5 && o.lo < x1 && o.hi > x0);
    if (!op) return void walls.push({ x: x0, y: y - t / 2, w: x1 - x0, h: t });
    if (op.lo > x0) walls.push({ x: x0, y: y - t / 2, w: op.lo - x0, h: t });
    if (op.hi < x1) walls.push({ x: op.hi, y: y - t / 2, w: x1 - op.hi, h: t });
  };

  // Vertical boundaries (between column gx-1 and gx).
  for (let gx = 0; gx <= layout.cols; gx++) {
    for (let gy = 0; gy < layout.rows; gy++) {
      if (owner.get(`${gx - 1},${gy}`) === owner.get(`${gx},${gy}`)) continue;
      emitV(gx * cw, gy * ch, (gy + 1) * ch);
    }
  }
  // Horizontal boundaries (between row gy-1 and gy).
  for (let gy = 0; gy <= layout.rows; gy++) {
    for (let gx = 0; gx < layout.cols; gx++) {
      if (owner.get(`${gx},${gy - 1}`) === owner.get(`${gx},${gy}`)) continue;
      emitH(gy * ch, gx * cw, (gx + 1) * cw);
    }
  }

  const spawnFloor = floors[layout.spawn] ?? Object.values(floors)[0];
  const smx = layout.spawnMx ?? 0.5;
  const smy = layout.spawnMy ?? 0.5;
  return {
    area: { x: 0, y: 0, w: area.w, h: area.h },
    cell: { w: cw, h: ch },
    floors,
    walls,
    spawn: { x: spawnFloor.x + spawnFloor.w * smx, y: spawnFloor.y + spawnFloor.h * smy },
  };
}

/**
 * Resolve a desired move against the walls. Treats the mover as an
 * axis-aligned box of half-size `r`; resolves X and Y independently so sliding
 * along a wall feels natural. Returns the corrected position.
 */
export function moveWithCollision(
  from: Point,
  dx: number,
  dy: number,
  r: number,
  walls: Rect[],
  bounds: Rect,
): Point {
  const hits = (x: number, y: number) => {
    if (x - r < bounds.x || x + r > bounds.x + bounds.w) return true;
    if (y - r < bounds.y || y + r > bounds.y + bounds.h) return true;
    for (const w of walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
    return false;
  };
  // Sub-step the move so a large step (low frame rate) can't tunnel through a
  // thin wall. Each axis is resolved independently for natural wall-sliding.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  let nx = from.x;
  let ny = from.y;
  for (let i = 0; i < steps; i++) {
    if (!hits(nx + sx, ny)) nx += sx;
    if (!hits(nx, ny + sy)) ny += sy;
  }
  return { x: nx, y: ny };
}
