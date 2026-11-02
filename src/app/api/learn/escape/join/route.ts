import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearnerSession } from "@/lib/learner-session";
import { getSessionByCode, upsertPlayer, buildState } from "@/lib/escape-session";
import { getEscapeRoom } from "@/lib/escape-rooms";

const schema = z.object({ code: z.string().min(2).max(12), roomSlug: z.string().min(1).optional() });

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const game = await getSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No room with that code" }, { status: 404 });
  if (game.status === "escaped") {
    return NextResponse.json({ error: "That game has already finished" }, { status: 409 });
  }
  // A code belongs to the room it was created in — don't let it join a different
  // room's scene (the client only renders the page's room).
  if (parsed.data.roomSlug && game.roomSlug !== parsed.data.roomSlug) {
    const other = getEscapeRoom(game.roomSlug);
    return NextResponse.json(
      {
        error: other
          ? `That code is for “${other.title}”. Open that room to join your friends.`
          : "That code is for a different room.",
      },
      { status: 409 },
    );
  }

  const learnerId = Number(session.id);
  await upsertPlayer({ sessionId: game.id, learnerId, name: session.name || "Player" });
  return NextResponse.json({ code: game.code, roomSlug: game.roomSlug, state: await buildState(game, learnerId) });
}
