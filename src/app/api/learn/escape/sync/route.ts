import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { escapeSessionPlayers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getSessionByCode, buildState } from "@/lib/escape-session";

const schema = z.object({
  code: z.string().min(2).max(12),
  atStation: z.string().max(64).nullable().optional(),
});

// Heartbeat + presence + poll, all in one call (kept cheap for ~1s polling).
export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const game = await getSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such room" }, { status: 404 });

  const learnerId = Number(session.id);
  const set: { lastSeen: Date; atStation?: string | null } = { lastSeen: new Date() };
  if (parsed.data.atStation !== undefined) set.atStation = parsed.data.atStation;
  await db
    .update(escapeSessionPlayers)
    .set(set)
    .where(
      and(
        eq(escapeSessionPlayers.sessionId, game.id),
        eq(escapeSessionPlayers.learnerId, learnerId),
      ),
    );

  return NextResponse.json({ state: await buildState(game, learnerId) });
}
