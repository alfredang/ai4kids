import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { generateKidSpeech } from "@/lib/gemini-tts";

export const maxDuration = 30;
const schema = z.object({ text: z.string().min(1).max(1000) });

/** Text → speech for the Talking Buddy, decoupled so the reply text can render first. */
export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ audio: null });

  const speech = await generateKidSpeech(parsed.data.text);
  return NextResponse.json({ audio: speech ? `data:${speech.mime};base64,${speech.base64}` : null });
}
