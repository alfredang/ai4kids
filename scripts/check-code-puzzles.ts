/**
 * Every shipped Code Quest level must be winnable within its move budget.
 *
 * The Android app guards its identical LEVELS with a JUnit test
 * (`CodePuzzlesEngineTest.everyLevelHasASolutionWithinMaxMoves`). This repo has
 * no test suite, so this script preserves that guarantee — run it after editing
 * LEVELS in src/lib/code-puzzles.ts.
 */
import { LEVELS, shortestSolution, solves } from "../src/lib/code-puzzles";

let failed = false;

LEVELS.forEach((level, i) => {
  const solution = shortestSolution(level);
  if (!solution) {
    console.error(`✗ Level ${i + 1}: the goal is unreachable`);
    failed = true;
    return;
  }
  if (solution.length > level.maxMoves) {
    console.error(
      `✗ Level ${i + 1}: needs ${solution.length} moves > budget ${level.maxMoves}`,
    );
    failed = true;
    return;
  }
  // Sanity: the engine agrees the found path solves the level.
  if (!solves(level, solution.map((step) => ({ kind: "move", step }) as const))) {
    console.error(`✗ Level ${i + 1}: engine disagrees that its own path solves it`);
    failed = true;
    return;
  }
  console.log(`✓ Level ${i + 1}: solvable in ${solution.length} / ${level.maxMoves} moves`);
});

if (failed) process.exit(1);
console.log(`All ${LEVELS.length} levels solvable within budget.`);
