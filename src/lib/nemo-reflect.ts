/**
 * Nemo self-improvement loop.
 *
 * After a lead is captured we replay the transcript through the Claude Agent
 * SDK and ask it to extract AT MOST ONE concrete tactical lesson that would
 * have lifted this lead's score. Lessons are stored in the `settings` row
 * `chat:nemo_lessons` and injected into Nemo's system prompt on the next
 * conversation — so every captured lead nudges the next one toward a higher
 * score.
 *
 * Designed to be fire-and-forget: the chat response returns immediately and
 * reflection runs in the background. Failures are logged and swallowed.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildClaudeEnv, SDK_ISOLATION } from "@/lib/anthropic-auth";
import { getCredential } from "@/lib/secrets";

export type NemoLesson = {
  lesson: string;
  addedAt: string; // ISO timestamp
  triggerScore: number; // the lead score that triggered this reflection
};

const KEY_LESSONS = "chat:nemo_lessons";
const MAX_LESSONS = 25;

export async function getNemoLessons(): Promise<NemoLesson[]> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, KEY_LESSONS))
      .limit(1);
    const row = rows[0];
    if (!row || !Array.isArray(row.value)) return [];
    return (row.value as NemoLesson[]).filter(
      (l) => l && typeof l.lesson === "string" && l.lesson.trim().length > 0,
    );
  } catch {
    return [];
  }
}

async function saveLessons(lessons: NemoLesson[]): Promise<void> {
  const trimmed = lessons.slice(-MAX_LESSONS);
  await db
    .insert(settings)
    .values({ key: KEY_LESSONS, value: trimmed as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: trimmed as unknown as object, updatedAt: new Date() },
    });
}

const REFLECTION_PROMPT = `You are reviewing a transcript from Nemo, a sales chatbot for Tertiary Infotech Academy. The visitor has just been captured as a lead.

Your task: identify AT MOST ONE concrete, tactical improvement Nemo could make next time to lift the lead score. The lead score (1-10) rewards five qualification signals being elicited inside the conversation:
1. Interest in a specific solution (LMS / TMS / ATO / TPQA / AI agent / etc.)
2. Business use-case clarity (problem, trigger, what's being replaced)
3. Budget intent (any envelope, even rough)
4. Timeline urgency (concrete date / quarter / event)
5. Implementation interest (end-to-end vs. co-deliver)

Output rules:
- If Nemo already elicited all five signals naturally, OR the lesson would duplicate an existing one, output exactly the single word: SKIP
- Otherwise output ONE sentence (under 200 chars) phrased as an imperative tactic Nemo can apply next time. Start with a verb. Be specific. No preamble, no markdown, no quotes.

Examples of good lessons:
- When a visitor mentions WSQ courses, immediately ask whether they are existing ATO or aspiring — it disambiguates the funnel in one turn.
- Offer the S$15k/year LMS anchor before the visitor asks pricing — it surfaces budget objections early.

Existing lessons (do NOT repeat these):
{EXISTING}

Transcript:
{TRANSCRIPT}

Final lead score: {SCORE}/10

Your output (one sentence OR the word SKIP):`;

export async function reflectOnLead(input: {
  transcript: string;
  score: number;
}): Promise<void> {
  // Don't burn cycles reflecting on perfect leads.
  if (input.score >= 10) return;

  const token = await getCredential("anthropic_auth_token");
  if (!token) return;

  const existing = await getNemoLessons();
  const existingText = existing.length
    ? existing.map((l, i) => `${i + 1}. ${l.lesson}`).join("\n")
    : "(none yet)";

  const prompt = REFLECTION_PROMPT.replace("{EXISTING}", existingText)
    .replace("{TRANSCRIPT}", input.transcript)
    .replace("{SCORE}", String(input.score));

  let result = "";
  try {
    for await (const msg of query({
      prompt,
      options: {
        env: buildClaudeEnv(token),
        maxTurns: 1,
        ...SDK_ISOLATION, // keeps CLAUDE.md / skills / memory out of the prompt
        allowedTools: [],
        disallowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
      },
    })) {
      if (msg.type === "result") {
        const r = (msg as { result?: string }).result;
        if (r) result = r;
      } else if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text" && !result) result += block.text;
        }
      }
    }
  } catch (err) {
    console.error("[nemo-reflect] SDK failed", err);
    return;
  }

  const cleaned = result.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!cleaned || /^skip$/i.test(cleaned)) return;
  if (cleaned.length > 300) return; // model went rogue, ignore
  // Dedupe — skip if the new lesson is a near-substring of any existing one.
  const lower = cleaned.toLowerCase();
  for (const l of existing) {
    const e = l.lesson.toLowerCase();
    if (e.includes(lower) || lower.includes(e)) return;
  }

  const next: NemoLesson[] = [
    ...existing,
    { lesson: cleaned, addedAt: new Date().toISOString(), triggerScore: input.score },
  ];
  try {
    await saveLessons(next);
    console.log("[nemo-reflect] learned:", cleaned);
  } catch (err) {
    console.error("[nemo-reflect] save failed", err);
  }
}
