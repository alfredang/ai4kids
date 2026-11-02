import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cardSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { getEngine } from "@/lib/card-games/registry";
import {
  getCardSessionByCode,
  isCardPlayer,
  buildCardState,
  recordCardCompletions,
} from "@/lib/card-session";

/** Marker error for engine rejections so we never confuse them with DB faults. */
class GameError extends Error {}

const schema = z.object({
  code: z.string().min(2).max(12),
  move: z.unknown(),
});

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
  if (!(await isCardPlayer(game.id, learnerId))) {
    return NextResponse.json({ error: "Join the game first" }, { status: 403 });
  }
  const engine = getEngine(game.gameSlug);
  if (!engine) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

  let becameDone = false;
  try {
    // Lock the row so two simultaneous moves can't corrupt the shared state.
    await db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(cardSessions)
        .where(eq(cardSessions.id, game.id))
        .for("update");
      if (!s || s.status !== "playing" || !s.state) {
        throw new GameError("The game isn't in play.");
      }
      const next = engine.move(s.state, learnerId, parsed.data.move); // may throw GameError-like
      const over = engine.isOver(next);
      const winners = over ? engine.winners(next) : [];
      await tx
        .update(cardSessions)
        .set({
          state: next,
          winners,
          status: over ? "done" : "playing",
          updatedAt: new Date(),
        })
        .where(eq(cardSessions.id, game.id));
      becameDone = over;
    });
  } catch (e) {
    // Engine rejections (illegal move) are friendly 400s; anything with a pg
    // error code is a real server fault.
    const err = e as Error & { code?: string };
    if (err.code) return NextResponse.json({ error: "Could not save your move" }, { status: 500 });
    return NextResponse.json({ error: err.message || "That move isn't allowed." }, { status: 400 });
  }

  const fresh = await getCardSessionByCode(parsed.data.code);
  if (becameDone && fresh) await recordCardCompletions(fresh);
  return NextResponse.json({ state: await buildCardState(fresh ?? game, learnerId) });
}
