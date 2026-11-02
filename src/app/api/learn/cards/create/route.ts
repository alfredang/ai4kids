import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cardSessions } from "@/db/schema";
import { getLearnerSession } from "@/lib/learner-session";
import { getCardGame } from "@/lib/card-games/meta";
import {
  generateCode,
  upsertCardPlayer,
  startGame,
  buildCardState,
  cleanupStaleCardSessions,
} from "@/lib/card-session";

const schema = z.object({
  gameSlug: z.string().min(1),
  mode: z.enum(["solo", "coop", "versus"]),
  options: z.object({ pairs: z.number().int().min(4).max(16) }).optional(),
});

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const game = getCardGame(parsed.data.gameSlug);
  if (!game) return NextResponse.json({ error: "Unknown game" }, { status: 404 });
  if (!game.modes.includes(parsed.data.mode)) {
    return NextResponse.json({ error: "That mode isn't available for this game" }, { status: 400 });
  }

  const learnerId = Number(session.id);
  await cleanupStaleCardSessions();

  let created: typeof cardSessions.$inferSelect | null = null;
  for (let attempt = 0; attempt < 6 && !created; attempt++) {
    try {
      const [row] = await db
        .insert(cardSessions)
        .values({
          code: generateCode(),
          gameSlug: game.slug,
          mode: parsed.data.mode,
          hostId: learnerId,
        })
        .returning();
      created = row;
    } catch {
      /* unique-code collision — retry */
    }
  }
  if (!created) return NextResponse.json({ error: "Could not start a game" }, { status: 500 });

  await upsertCardPlayer({ sessionId: created.id, learnerId, name: session.name || "Player" });

  // Solo games skip the lobby — deal immediately.
  if (parsed.data.mode === "solo") {
    try {
      created = await startGame(created, parsed.data.options);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ code: created.code, state: await buildCardState(created, learnerId) });
}
