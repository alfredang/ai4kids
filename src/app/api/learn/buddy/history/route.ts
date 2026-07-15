import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import { getBuddyHistory, clearBuddyChat } from "@/lib/buddy-chat";

/** Restore the child's current chat thread (messages since their last "new chat"). */
export async function GET() {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  const messages = await getBuddyHistory(Number(session.id), 50);
  return NextResponse.json({ messages });
}

/** "New chat" — reset the buddy's context + the child's view. Does NOT delete the
 *  log (parents keep full visibility). */
export async function DELETE() {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  await clearBuddyChat(Number(session.id));
  return NextResponse.json({ ok: true });
}
