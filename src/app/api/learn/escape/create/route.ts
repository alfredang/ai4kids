import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { escapeSessions } from "@/db/schema";
import { getLearnerSession } from "@/lib/learner-session";
import { getEscapeRoom } from "@/lib/escape-rooms";
import { generateCode, upsertPlayer, buildState, cleanupStaleSessions } from "@/lib/escape-session";

const schema = z.object({ roomSlug: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const room = getEscapeRoom(parsed.data.roomSlug);
  if (!room) return NextResponse.json({ error: "Unknown room" }, { status: 404 });

  const learnerId = Number(session.id);

  // Free up codes from finished/abandoned games before claiming a new one.
  await cleanupStaleSessions();

  // Create the session with a unique code (retry a few times on collision).
  let created: typeof escapeSessions.$inferSelect | null = null;
  for (let attempt = 0; attempt < 6 && !created; attempt++) {
    try {
      const [row] = await db
        .insert(escapeSessions)
        .values({ code: generateCode(), roomSlug: room.slug, hostId: learnerId })
        .returning();
      created = row;
    } catch {
      /* unique-code collision — try again */
    }
  }
  if (!created) return NextResponse.json({ error: "Could not start a room" }, { status: 500 });

  await upsertPlayer({ sessionId: created.id, learnerId, name: session.name || "Player" });
  return NextResponse.json({ code: created.code, state: await buildState(created, learnerId) });
}
