import { NextResponse } from "next/server"
import { z } from "zod"
import { getPortalSession } from "@/lib/portal-session"
import { generateKidReply } from "@/lib/gemini-chat"
import { saveBuddyMessage, getBuddyHistory } from "@/lib/buddy-chat"
import { awardBuddyPointsCapped } from "@/lib/activities"
import { rateLimit } from "@/lib/rate-limit"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export const maxDuration = 60;
const schema = z.object({ message: z.string().min(1).max(500) });

const KID_SYSTEM =
  "You are a friendly, cheerful buddy for a young child (ages 5-10) having an ongoing chat. Reply in 1-3 short, simple, positive sentences. Remember what was said earlier in the conversation. Never discuss anything scary, violent, sexual, or unsafe. If asked something inappropriate, gently redirect to something fun. No links, no complex words.";

/** Leading "Buddy:" / "Child:" role labels the model sometimes echoes from the
 *  replayed transcript. Stripped on write (so they aren't stored) and on read (so
 *  any already-saved ones don't keep seeding the pattern). */
const LEADING_LABEL = /^(?:\s*(?:buddy|child)\s*:\s*)+/i;

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Say something!" }, { status: 400 });
  const learnerId = Number(session.id);

  // Curb spam / runaway AI cost. Rejected turns are not logged.
  if (!rateLimit(`buddy:${learnerId}`, 20, 60_000)) {
    return NextResponse.json(
      { reply: "Woah, you're chatting super fast! Let's take a little breath and try again in a moment. 😊" },
      { status: 429 },
    );
  }

  // Tune vocabulary to the child's age band.
  const [u] = await db.select({ ageGroup: users.ageGroup }).from(users).where(eq(users.id, learnerId)).limit(1);
  const system = u?.ageGroup
    ? `${KID_SYSTEM} The child is around age ${u.ageGroup}; use words and ideas suited to that age.`
    : KID_SYSTEM;

  // Persist the child's turn, then replay recent history from the DB for context
  // (survives refresh; the child's "new chat" bounds how far back this reaches).
  await saveBuddyMessage(learnerId, "user", parsed.data.message);
  const history = await getBuddyHistory(learnerId, 10);
  const conversation = history
    .map((m) => `${m.role === "user" ? "Child" : "Buddy"}: ${m.content.trim().replace(LEADING_LABEL, "")}`)
    .join("\n\n");

  const fallbackReply = "Hmm, my ears are sleepy! Can you say that again?";
  const raw = (await generateKidReply(conversation, system)) ?? fallbackReply;
  // The history is replayed to the model as a "Child:/Buddy:" transcript, so the
  // model sometimes continues the pattern and prefixes its answer with "Buddy:".
  // Strip any leading role label BEFORE saving — otherwise the prefixed reply is
  // stored and the transcript grows "Buddy: Buddy: …", reinforcing it every turn.
  const reply = raw.replace(LEADING_LABEL, "").trim() || fallbackReply;
  await saveBuddyMessage(learnerId, "buddy", reply);
  await awardBuddyPointsCapped(learnerId); // small points, capped per day

  // Text returns fast; audio is fetched separately via /api/learn/buddy/speak.
  return NextResponse.json({ reply });
}
