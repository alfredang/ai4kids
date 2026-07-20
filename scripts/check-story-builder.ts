/**
 * Story Builder invariants — the branching tale must always fork twice, reach
 * four distinct endings, flatten correctly along any chosen path, and rewind to
 * the fork it just answered.
 *
 * The Android app guards this logic with JUnit tests over StoryEngine.kt
 * (StoryEngineTest). This repo has no test runner, so this script stands in — run
 * it after editing src/lib/story-builder/templates.ts (mirrors the
 * check:code-puzzles idiom).
 */
import {
  buildStory,
  buildTimeline,
  remainingFrom,
  an,
  HEROES,
  PLACES,
  OBJECTS,
  MOODS,
  type Branch,
} from "../src/lib/story-builder/templates";

let failed = false;
function fail(msg: string) {
  console.error(`✗ ${msg}`);
  failed = true;
}

const VOWELS = ["a", "e", "i", "o", "u"];
const rand = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const randStory = () => buildStory(rand(HEROES), rand(PLACES), rand(OBJECTS), rand(MOODS));

// The four leaf paths through the two forks: [firstUseA, secondUseA].
const LEAF_PATHS: [boolean, boolean][] = [
  [true, true], [true, false], [false, true], [false, false],
];
const branchOf = (node: { choiceA?: Branch; choiceB?: Branch }, useA: boolean) =>
  useA ? node.choiceA : node.choiceB;
const isProblem = (s: string) => s.includes("What should");

// --- 1 + 2: every story forks twice; all four endings reachable, non-empty, "The End!" ---
{
  let ok = true;
  for (let i = 0; i < 500 && ok; i++) {
    const story = randStory();
    for (const [useA1, useA2] of LEAF_PATHS) {
      const b1 = branchOf(story, useA1);
      if (!b1 || !(b1.problem && b1.choiceA && b1.choiceB)) {
        fail("a first-level branch does not fork a second time"); ok = false; break;
      }
      const b2 = branchOf(b1, useA2);
      if (!b2 || b2.pages.length === 0) { fail("a leaf path is empty/unreachable"); ok = false; break; }
      // Reachable + terminates via the timeline the UI actually plays.
      const { pages } = buildTimeline(story, [b1, b2]);
      if (pages.some((p) => p.trim() === "")) { fail("timeline has an empty page"); ok = false; break; }
      if (!pages[pages.length - 1].includes("The End!")) {
        fail(`leaf [${useA1 ? "A" : "B"},${useA2 ? "A" : "B"}] does not end in "The End!"`); ok = false; break;
      }
    }
  }
  if (ok) console.log('✓ every story forks twice; all four endings reachable, non-empty, end in "The End!"');
}

// --- 3: buildTimeline forks[k] always indexes a problem page ---
{
  let ok = true;
  for (let i = 0; i < 200 && ok; i++) {
    const story = randStory();
    const [useA1, useA2] = rand(LEAF_PATHS);
    const b1 = branchOf(story, useA1)!;
    const b2 = branchOf(b1, useA2)!;
    for (const chosen of [[], [b1], [b1, b2]] as Branch[][]) {
      const { pages, forks } = buildTimeline(story, chosen);
      for (const k of forks) {
        if (pages[k] === undefined || !isProblem(pages[k])) { fail(`forks index ${k} is not a problem page`); ok = false; break; }
      }
      if (pages[forks[0]] !== story.problem) { fail("forks[0] is not the root problem"); ok = false; }
      if (forks[1] !== undefined && pages[forks[1]] !== b1.problem) { fail("forks[1] is not the first branch's problem"); ok = false; }
    }
  }
  if (ok) console.log("✓ every fork index points at its problem page");
}

// --- 4: rewinding one choice lands back on the fork it just answered ---
{
  let ok = true;
  for (let i = 0; i < 200 && ok; i++) {
    const story = randStory();
    const [useA1, useA2] = rand(LEAF_PATHS);
    const b1 = branchOf(story, useA1)!;
    const b2 = branchOf(b1, useA2)!;
    const chosen: Branch[] = [b1, b2];
    // replayFork: next = chosen.slice(0,-1); land on buildTimeline(story,next).forks[next.length].
    const afterSecond = chosen.slice(0, -1); // [b1] — landing must be the 2nd fork (b1.problem)
    const t2 = buildTimeline(story, afterSecond);
    if (t2.pages[t2.forks[afterSecond.length]] !== b1.problem) { fail("rewinding the 2nd choice did not land on the 2nd fork"); ok = false; continue; }
    const afterFirst = afterSecond.slice(0, -1); // [] — landing must be the 1st fork (story.problem)
    const t1 = buildTimeline(story, afterFirst);
    if (t1.pages[t1.forks[afterFirst.length]] !== story.problem) { fail("rewinding the 1st choice did not land on the 1st fork"); ok = false; }
  }
  if (ok) console.log("✓ rewinding a choice lands back on the fork it answered");
}

// --- 5: an() never emits "a island" (vowel-initial words get "an") ---
{
  let ok = true;
  for (const c of [...PLACES, ...OBJECTS, ...MOODS]) {
    const want = VOWELS.includes(c.name[0].toLowerCase()) ? "an" : "a";
    if (an(c.name) !== want) { fail(`an("${c.name}") = "${an(c.name)}", want "${want}"`); ok = false; }
  }
  const island = PLACES.find((p) => p.name === "island")!;
  for (let i = 0; i < 300 && ok; i++) {
    const story = buildStory(rand(HEROES), island, rand(OBJECTS), rand(MOODS));
    const text = [...story.pre, story.problem].join("\n");
    if (/\ba island\b/i.test(text)) { fail(`generated "a island" in: ${text}`); ok = false; }
  }
  if (ok) console.log('✓ an() picks "an" for vowel-initial words; no "a island" in generated prose');
}

// remainingFrom sanity: a full first-level branch counts its own page plus the
// grafted second fork's pages, so it's always positive.
if (remainingFrom(buildStory(HEROES[0], PLACES[0], OBJECTS[0], MOODS[0])) <= 0) {
  fail("remainingFrom(story) should be > 0");
}

if (failed) process.exit(1);
console.log("All Story Builder invariants hold.");
