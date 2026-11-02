import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearnerSession } from "@/lib/learner-session";
import { recordCompletion } from "@/lib/activities";

const schema = z.object({
  activitySlug: z.string().min(1),
  score: z.number().int().min(0).max(100000),
  metadata: z.unknown().optional(),
});

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const result = await recordCompletion({
    learnerId: Number(session.id),
    activitySlug: parsed.data.activitySlug,
    score: parsed.data.score,
    metadata: parsed.data.metadata,
  });
  if (!result.ok) return NextResponse.json({ error: "Unknown activity" }, { status: 404 });
  return NextResponse.json({ ok: true, totalScore: result.totalScore });
}
