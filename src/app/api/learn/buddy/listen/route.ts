import { NextResponse } from "next/server";
import { getLearnerSession } from "@/lib/learner-session";
import { transcribeKidAudio } from "@/lib/whisper-stt";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

/** Audio upload → transcript (Cloudflare Whisper). Feeds the buddy's tap-to-talk. */
export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  // Over the limit → empty transcript (no STT call).
  if (!rateLimit(`listen:${session.id}`, 20, 60_000)) return NextResponse.json({ text: "" });

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) return NextResponse.json({ text: "" });
  // Guard against oversized uploads (~10MB of audio is plenty for a short turn).
  if (audio.byteLength > 10_000_000) return NextResponse.json({ text: "" });

  const text = await transcribeKidAudio(audio);
  return NextResponse.json({ text: text ?? "" });
}
