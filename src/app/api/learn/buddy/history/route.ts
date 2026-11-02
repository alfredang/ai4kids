import { NextResponse } from "next/server";
import { getLearnerSession } from "@/lib/learner-session";
import { getBuddyHistory, clearBuddyChat } from "@/lib/buddy-chat";

/** Restore the child's current chat thread (messages since their last "new chat"). */
export async function GET() {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  const messages = await getBuddyHistory(Number(session.id), 50);
  return NextResponse.json({ messages });
}

/** "New chat" — reset the buddy's context + the child's view. Does NOT delete the
 *  log (parents keep full visibility). */
export async function DELETE() {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  await clearBuddyChat(Number(session.id));
  return NextResponse.json({ ok: true });
}
