import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearnerSession } from "@/lib/learner-session";
import { getCardGame } from "@/lib/card-games/meta";
import { getCardSessionByCode, upsertCardPlayer, buildCardState } from "@/lib/card-session";

const schema = z.object({
  code: z.string().min(2).max(12),
  gameSlug: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const game = await getCardSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No game with that code" }, { status: 404 });
  if (game.status === "done") {
    return NextResponse.json({ error: "That game has already finished" }, { status: 409 });
  }
  if (game.status !== "lobby") {
    return NextResponse.json({ error: "That game has already started" }, { status: 409 });
  }
  // A code belongs to the game it was created in — don't cross the streams.
  if (parsed.data.gameSlug && game.gameSlug !== parsed.data.gameSlug) {
    const other = getCardGame(game.gameSlug);
    return NextResponse.json(
      {
        error: other
          ? `That code is for “${other.title}”. Open that game to join your friends.`
          : "That code is for a different game.",
      },
      { status: 409 },
    );
  }

  const learnerId = Number(session.id);
  await upsertCardPlayer({ sessionId: game.id, learnerId, name: session.name || "Player" });
  return NextResponse.json({
    code: game.code,
    gameSlug: game.gameSlug,
    state: await buildCardState(game, learnerId),
  });
}
