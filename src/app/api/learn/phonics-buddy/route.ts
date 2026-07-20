import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { getCredential } from "@/lib/secrets";
import { isAiConfigured } from "@/lib/ai";
import { generateKidReply } from "@/lib/gemini-chat";

export const maxDuration = 30;

/**
 * The optional "Phonics Buddy": short, kid-friendly hints during a round. The
 * client sends a *structured* request (never a raw prompt) and the server
 * templates the wording, so there's no prompt-injection surface. Degrades to null
 * when no provider is configured (the games stay fully playable without it).
 *
 * Hints only — the end-of-world praise is hardcoded on the client, because a
 * celebration must be instant and an LLM round-trip isn't.
 *
 * Goes through `generateKidReply` — Gemini Flash primary, Claude Agent SDK
 * fallback — like the Talking Buddy, and like the Gemini Buddy this was ported
 * from. That Gemini path is scoped to the children's games; the CMS chatbot +
 * admin AI Assist remain Agent-SDK-only per CLAUDE.md.
 */

const PHONICS_SYSTEM =
  "You are a cheerful phonics tutor for a young child (around age 5) learning to read. " +
  "Reply with exactly ONE short sentence in simple words — warm, playful and encouraging. " +
  "Never discuss anything scary, violent or unsafe. No emojis, no links.";

const schema = z.object({
  type: z.literal("hint"),
  game: z.enum(["pop", "build", "rhyme", "listen", "blend", "digraph"]),
  word: z.string().min(1).max(24),
  /** "pop" only — the grapheme the round's sound maps to in this word. */
  letter: z.string().max(2).optional(),
  /** "digraph" only — the letter team that spells the round's sound. */
  team: z.string().max(2).optional(),
  /** "rhyme" only — the option that rhymes, so the hint can avoid naming it. */
  answer: z.string().max(24).optional(),
});

// GET → whether the Buddy is available, so the client can hide the button. Either
// provider will do: Gemini serves it, and Claude alone still works via fallback.
export async function GET() {
  const [gemini, claude] = await Promise.all([getCredential("gemini_api_key"), isAiConfigured()]);
  return NextResponse.json({ enabled: Boolean(gemini) || claude });
}

/** The round's task. The tutor persona and safety frame live in PHONICS_SYSTEM. */
function buildPrompt(input: z.infer<typeof schema>): string {
  const limit = "At most 15 words.";
  switch (input.game) {
    case "pop":
      return `Help the child hear that the word "${input.word}" starts with the letter "${input.letter ?? ""}". ${limit}`;
    case "build":
      return `Help the child sound out and spell the word "${input.word}" letter by letter. ${limit}`;
    case "rhyme":
      // The answer is named so the model knows the exact word to withhold; asked
      // only to avoid "the answer" it can't see, it guesses the rhyme and says it.
      return input.answer
        ? `The child must spot which picture rhymes with "${input.word}". Tell them what ending sound to listen for. Never write the word "${input.answer}". ${limit}`
        : `The child must spot which picture rhymes with "${input.word}". Tell them what ending sound to listen for, without naming any word that rhymes with it. ${limit}`;
    case "listen":
    case "blend":
      return `Give a fun clue about the word "${input.word}" so the child can pick it. Never write the word "${input.word}" itself. ${limit}`;
    case "digraph":
      return `Remind the child that the two letters "${input.team ?? ""}" make ONE sound, like in "${input.word}". ${limit}`;
  }
}

/**
 * The word a hint must not give away, if any. Naming it hands the child the round.
 * For pop/build/digraph nothing is withheld — the letter, the spelling and the
 * letter team *are* the teaching point.
 */
function withheldWord(input: z.infer<typeof schema>): string | null {
  switch (input.game) {
    case "rhyme":
      return input.answer ?? null;
    case "listen":
    case "blend":
      return input.word;
    default:
      return null;
  }
}

/** Whole-word, case-insensitive — "car" must not match "scary". */
function mentions(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
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
  const message = await generateKidReply(buildPrompt(parsed.data), PHONICS_SYSTEM);
  // Telling a model to withhold a word doesn't reliably stop it saying the word,
  // so enforce it here. Drop a leaking hint rather than answer the round for the
  // child — the client shows its generic nudge when the message is null.
  const withheld = withheldWord(parsed.data);
  if (message && withheld && mentions(message, withheld)) {
    console.warn(`[phonics-buddy] dropped a hint that leaked "${withheld}"`);
    return NextResponse.json({ message: null });
  }
  return NextResponse.json({ message });
}
