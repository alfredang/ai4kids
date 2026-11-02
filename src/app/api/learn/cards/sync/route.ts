import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cardSessionPlayers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getCardSessionByCode, buildCardState, maybeSkipAbsent, maybeTick } from "@/lib/card-session";

const schema = z.object({ code: z.string().min(2).max(12) });

// Heartbeat + poll in one cheap call (~1s polling cadence on the client).
export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const game = await getCardSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such game" }, { status: 404 });

  const learnerId = Number(session.id);
  await db
    .update(cardSessionPlayers)
    .set({ lastSeen: new Date() })
    .where(
      and(
        eq(cardSessionPlayers.sessionId, game.id),
        eq(cardSessionPlayers.learnerId, learnerId),
      ),
    );

  // Advance real-time games whose round clock has expired, then keep turn-based
  // games moving if the player on turn has left mid-game.
  let fresh = await maybeTick(game);
  fresh = await maybeSkipAbsent(fresh);
  return NextResponse.json({ state: await buildCardState(fresh, learnerId) });
}
