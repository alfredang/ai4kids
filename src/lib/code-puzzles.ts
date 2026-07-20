/**
 * Pure game logic for Code Puzzles — no React, so it stays testable and can be
 * imported from a server component. `/learn/code-puzzles` drives this model and
 * renders it. The child sequences arrow `Step`s (optionally wrapped in a repeat
 * `Loop`) into a program, which `simulate` walks across a `Level`'s grid.
 *
 * Ported from the Android app's `CodePuzzlesEngine.kt` (the source of truth for
 * this game — see that repo's `web-parity` skill). Keep the rules and LEVELS in
 * step with it. This is the *deliberate exception* to the web-first flow: unlike
 * the other games, Code Puzzles changes originate on Android — edit
 * CodePuzzlesEngine.kt first, then mirror here and re-run npm run check:code-puzzles.
 */

/** A single arrow move. `glyph` is used only for on-screen rendering. */
export type Step = "up" | "down" | "left" | "right";

export const STEPS: Step[] = ["up", "down", "left", "right"];

export const STEP_GLYPH: Record<Step, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/** Grid coordinate, (x, y) with y pointing up. */
export type Cell = readonly [number, number];

/**
 * One puzzle: a square `size`×`size` grid with a `start`, a `goal`, blocked
 * `walls`, and a `maxMoves` budget.
 */
export type Level = {
  size: number;
  start: Cell;
  goal: Cell;
  walls: readonly Cell[];
  /**
   * Most steps the child may queue — keeps the plan short and forces them to
   * think about an efficient route rather than spamming arrows.
   */
  maxMoves: number;
};

/** The built-in puzzles, in unlock order. */
export const LEVELS: readonly Level[] = [
  { size: 4, start: [0, 0], goal: [3, 0], walls: [], maxMoves: 6 },
  { size: 4, start: [0, 3], goal: [3, 0], walls: [[2, 2], [2, 1]], maxMoves: 10 },
  { size: 5, start: [0, 0], goal: [4, 4], walls: [[2, 2], [3, 2], [1, 3]], maxMoves: 14 },
];

/** A program instruction: a single `move`, or a `loop` that repeats a body. */
export type Instr =
  | { kind: "move"; step: Step }
  | { kind: "loop"; body: Step[]; times: number };

export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** How many grid moves this program actually executes (loops expanded). */
export function moveCount(program: readonly Instr[]): number {
  return program.reduce(
    (n, instr) => n + (instr.kind === "move" ? 1 : instr.body.length * instr.times),
    0,
  );
}

/** Flatten to the raw move sequence the runner walks. */
export function expand(program: readonly Instr[]): Step[] {
  return program.flatMap((instr) =>
    instr.kind === "move"
      ? [instr.step]
      : Array.from({ length: instr.times }, () => instr.body).flat(),
  );
}

/**
 * Apply one `dir` to `from`, clamping to the grid and refusing to enter a wall
 * (an illegal move leaves the robot where it was — matching the on-screen runner).
 */
export function step(level: Level, from: Cell, dir: Step): Cell {
  const [x, y] = from;
  const next: Cell =
    dir === "up" ? [x, y + 1] : dir === "down" ? [x, y - 1] : dir === "left" ? [x - 1, y] : [x + 1, y];
  const [nx, ny] = next;
  const inGrid = nx >= 0 && nx < level.size && ny >= 0 && ny < level.size;
  const blocked = level.walls.some((w) => sameCell(w, next));
  return inGrid && !blocked ? next : from;
}

/** Walk `program` from `level.start` and return the robot's final cell. */
export function simulate(level: Level, program: readonly Instr[]): Cell {
  let pos: Cell = level.start;
  for (const dir of expand(program)) pos = step(level, pos, dir);
  return pos;
}

/** True when `program` lands the robot exactly on the goal. */
export function solves(level: Level, program: readonly Instr[]): boolean {
  return sameCell(simulate(level, program), level.goal);
}

/**
 * Shortest step sequence from start to goal via `step`, or null if the goal is
 * unreachable. The Android port guards its LEVELS with this in a unit test; this
 * repo has no test suite, so `npm run check:code-puzzles` runs it instead.
 */
export function shortestSolution(level: Level): Step[] | null {
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const queue: Array<{ pos: Cell; path: Step[] }> = [{ pos: level.start, path: [] }];
  const seen = new Set([key(level.start)]);
  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (sameCell(pos, level.goal)) return path;
    for (const dir of STEPS) {
      const next = step(level, pos, dir);
      if (!sameCell(next, pos) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push({ pos: next, path: [...path, dir] });
      }
    }
  }
  return null;
}
