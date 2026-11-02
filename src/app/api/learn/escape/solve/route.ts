import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { escapeSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getEscapeRoom } from "@/lib/escape-rooms";
import {
  getSessionByCode,
  buildState,
  isPlayer,
  POINTS_FIRST_TRY,
  POINTS_WITH_HELP,
} from "@/lib/escape-session";

const schema = z.object({
  code: z.string().min(2).max(12),
  stationId: z.string().min(1).max(64),
  firstTry: z.boolean().default(false),
});

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const game = await getSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such room" }, { status: 404 });
  if (!(await isPlayer(game.id, Number(session.id)))) {
    return NextResponse.json({ error: "Join the room first" }, { status: 403 });
  }

  const room = getEscapeRoom(game.roomSlug);
  const valid = room?.stations.some((s) => s.id === parsed.data.stationId);
  if (!valid) return NextResponse.json({ error: "Unknown object" }, { status: 400 });

  // Lock the session row so two simultaneous solves can't double-count.
  await db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(escapeSessions)
      .where(eq(escapeSessions.id, game.id))
      .for("update");
    if (!s) return;
    const solved = (s.solved as string[]) ?? [];
    if (solved.includes(parsed.data.stationId)) return; // a teammate got it first
    solved.push(parsed.data.stationId);
    const points = s.points + (parsed.data.firstTry ? POINTS_FIRST_TRY : POINTS_WITH_HELP);
    await tx
      .update(escapeSessions)
      .set({ solved, points, updatedAt: new Date() })
      .where(eq(escapeSessions.id, game.id));
  });

  const fresh = await getSessionByCode(parsed.data.code);
  return NextResponse.json({ state: await buildState(fresh!, Number(session.id)) });
}
