import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearnerSession } from "@/lib/learner-session";
import { getCardSessionByCode, startGame, buildCardState } from "@/lib/card-session";

const schema = z.object({
  code: z.string().min(2).max(12),
  options: z.object({ pairs: z.number().int().min(4).max(16) }).optional(),
});

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  let game = await getCardSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such game" }, { status: 404 });
  if (game.hostId !== Number(session.id)) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }
  if (game.status === "lobby") {
    try {
      game = await startGame(game, parsed.data.options);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  return NextResponse.json({ state: await buildCardState(game, Number(session.id)) });
}
