import { NextResponse } from "next/server"
import { z } from "zod"
import { getPortalSession } from "@/lib/portal-session"
import { generateKidReply } from "@/lib/gemini-chat"

export const maxDuration = 60;
const schema = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "buddy"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
});

const KID_SYSTEM =
  "You are a friendly, cheerful buddy for a young child (ages 5-10) having an ongoing chat. Reply in 1-3 short, simple, positive sentences. Remember what was said earlier in the conversation. Never discuss anything scary, violent, sexual, or unsafe. If asked something inappropriate, gently redirect to something fun. No links, no complex words.";

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Say something!" }, { status: 400 });

  // Replay the recent conversation so the buddy has memory of prior turns.
  const conversation = [
    ...(parsed.data.history ?? []),
    { role: "user" as const, content: parsed.data.message },
  ]
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Child" : "Buddy"}: ${m.content.trim()}`)
    .join("\n\n");

  const reply = (await generateKidReply(conversation, KID_SYSTEM))
    ?? "Hmm, my ears are sleepy! Can you say that again?";

  // Text returns fast; audio is fetched separately via /api/learn/buddy/speak.
  return NextResponse.json({ reply });
}