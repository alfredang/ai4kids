import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { escapeSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getSessionByCode, buildState } from "@/lib/escape-session";

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
  if (game.hostId !== Number(session.id)) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }
  if (game.status === "lobby") {
    await db
      .update(escapeSessions)
      .set({ status: "playing", updatedAt: new Date() })
      .where(eq(escapeSessions.id, game.id));
    game.status = "playing";
  }
  return NextResponse.json({ state: await buildState(game, Number(session.id)) });
}
