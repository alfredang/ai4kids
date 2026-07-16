import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";
import { HEROES, PLACES, OBJECTS, MOODS, buildStory, secondFork, type Story, type Branch, type Choice } from "@/lib/story-builder/templates";

export const maxDuration = 45;

// The child sends the *indices* of their picks (0–3 in each list), so there's no
// free-text to sanitize — we resolve them to the known Choice sets server-side.
const schema = z.object({
  hero: z.number().int().min(0).max(HEROES.length - 1),
  place: z.number().int().min(0).max(PLACES.length - 1),
  object: z.number().int().min(0).max(OBJECTS.length - 1),
  mood: z.number().int().min(0).max(MOODS.length - 1),
});

type BranchJson = {
  emoji?: string;
  label?: string;
  pages?: string[];
  problem?: string;
  choiceA?: BranchJson;
  choiceB?: BranchJson;
};
type StoryJson = { pre?: string[]; problem?: string; choiceA?: BranchJson; choiceB?: BranchJson };

// The story forks at most twice (the opening problem, then one follow-up twist).
// Never trust the model's nesting depth or page counts — cap both.
const MAX_FORK_DEPTH = 2;
const MAX_PAGES_PER_BRANCH = 4;

const clean = (s: unknown) => String(s ?? "").trim();
const cleanPages = (arr: unknown) =>
  (Array.isArray(arr) ? arr : []).map(clean).filter(Boolean).slice(0, MAX_PAGES_PER_BRANCH);

/**
 * Sanitize one branch, recursing into its follow-up fork. `depth` is the number
 * of forks already consumed on this path.
 *
 * Degrading beats discarding: the nested fork is only attached when the problem
 * text AND both sub-branches survive. A model that omits, truncates or malforms
 * the second fork therefore yields a valid single-fork story (still perfectly
 * playable) instead of throwing away good prose and dropping to the template.
 */
function sanitizeBranch(
  b: BranchJson | undefined,
  fallbackEmoji: string,
  fallbackLabel: string,
  depth: number,
): Branch | null {
  if (!b || typeof b !== "object") return null;
  const pages = cleanPages(b.pages);
  if (!pages.length) return null;

  const branch: Branch = {
    emoji: clean(b.emoji) || fallbackEmoji,
    label: clean(b.label) || fallbackLabel,
    pages,
  };
  if (depth < MAX_FORK_DEPTH) {
    const problem = clean(b.problem);
    const a = sanitizeBranch(b.choiceA, "🎁", "Share the magic", depth + 1);
    const c = sanitizeBranch(b.choiceB, "🗺️", "Go exploring", depth + 1);
    if (problem && a && c) Object.assign(branch, { problem, choiceA: a, choiceB: c });
  }
  return branch;
}

/**
 * Ask Claude for the story's FIRST ACT only, then graft the offline engine's
 * second fork onto each branch — giving four endings at no extra wait.
 *
 * Why not ask the model for the whole two-fork tree? Measured (interleaved, real
 * prompts): the nested version runs ~58s median vs ~22s for the first act, and
 * routinely blew past this route's 45s maxDuration — so the child would wait
 * longer AND usually still land on the template story. The first act alone is
 * actually *less* text than the previous single-fork prompt, so this is no
 * slower than what shipped before.
 */
async function generateWithClaude(h: Choice, p: Choice, o: Choice, m: Choice): Promise<Story | null> {
  const json = await askClaudeJson<StoryJson>(
    `Write the first half of a short, gentle, G-rated adventure story for a child aged 7 to 9.
Ingredients to use:
- Hero: ${h.name} ${h.emoji}
- Place: ${p.name} ${p.emoji}
- Magic item: ${o.name} ${o.emoji}
- Tone/mood: ${m.name}

The child reads three pages, meets a friendly problem, then picks one of two ways to solve it. Return ONLY JSON of exactly this shape:
{"pre":["page","page","page"],"problem":"a friendly obstacle, ending with the question: What should the ${h.name} do?","choiceA":{"emoji":"${o.emoji}","label":"Use the ${o.name}","pages":["solve it using the ${o.name}"]},"choiceB":{"emoji":"🤝","label":"Call for friends","pages":["solve it by asking friends for help"]}}
Rules: each page is 1 to 2 short sentences. Keep it positive, kind, and age-appropriate — no violence, scariness, or romance. Weave the emojis into the sentences. "pre" must have exactly 3 pages. Do NOT end the story — the adventure continues after the pick, so no "The End". Do NOT give the hero a personal name; always call it "the ${h.name}", so the rest of the tale matches.`,
    { model: "haiku" },
  );
  if (!json) return null;
  const pre = cleanPages(json.pre);
  const problem = clean(json.problem);
  const choiceA = sanitizeBranch(json.choiceA, o.emoji, `Use the ${o.name}`, 1);
  const choiceB = sanitizeBranch(json.choiceB, "🤝", "Call for friends", 1);
  if (!pre.length || !problem || !choiceA || !choiceB) return null;

  // Give each branch its own second fork (so A and B get different twists). If
  // the model volunteered a valid one anyway, keep its prose over the template's.
  const graft = (b: Branch): Branch =>
    b.problem && b.choiceA && b.choiceB ? b : { ...b, ...secondFork(h, p, o, m) };

  return { pre, problem, choiceA: graft(choiceA), choiceB: graft(choiceB) };
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const h = HEROES[parsed.data.hero];
  const p = PLACES[parsed.data.place];
  const o = OBJECTS[parsed.data.object];
  const m = MOODS[parsed.data.mood];

  const story = (await generateWithClaude(h, p, o, m)) ?? buildStory(h, p, o, m);
  return NextResponse.json({ story });
}
