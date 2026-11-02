import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { escapeSessions, escapeSessionPlayers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getEscapeRoom } from "@/lib/escape-rooms";
import { recordCompletion } from "@/lib/activities";
import { getSessionByCode, buildState, isPlayer, POINTS_FIRST_TRY } from "@/lib/escape-session";

const schema = z.object({ code: z.string().min(2).max(12) });

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const game = await getSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such room" }, { status: 404 });
  if (!(await isPlayer(game.id, Number(session.id)))) {
    return NextResponse.json({ error: "Join the room first" }, { status: 403 });
  }

  const room = getEscapeRoom(game.roomSlug);
  const total = room?.stations.length ?? 0;
  const solved = (game.solved as string[]) ?? [];

  // Only finish once every object is solved, and only do the scoring once.
  if (game.status !== "escaped" && total > 0 && solved.length >= total) {
    const score = Math.round((game.points / (total * POINTS_FIRST_TRY)) * 100);
    await db
      .update(escapeSessions)
      .set({ status: "escaped", updatedAt: new Date() })
      .where(eq(escapeSessions.id, game.id));
    game.status = "escaped";

    // Record a completion for every teammate so it counts on their dashboards.
    const players = await db
      .select({ learnerId: escapeSessionPlayers.learnerId })
      .from(escapeSessionPlayers)
      .where(eq(escapeSessionPlayers.sessionId, game.id));
    await Promise.all(
      players.map((p) =>
        recordCompletion({
          learnerId: p.learnerId,
          activitySlug: room!.activitySlug,
          score,
          metadata: { room: game.roomSlug, code: game.code, coop: true },
        }).catch(() => {}),
      ),
    );
  }

  return NextResponse.json({ state: await buildState(game, Number(session.id)) });
}
