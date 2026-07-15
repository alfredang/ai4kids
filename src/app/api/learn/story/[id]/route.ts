import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/db";
import { learnerStories } from "@/db/schema";

/** Delete one of the learner's own saved stories. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const storyId = Number((await params).id);
  if (!Number.isInteger(storyId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [row] = await db.select().from(learnerStories).where(eq(learnerStories.id, storyId)).limit(1);
  // 404 (not 403) when it isn't theirs — don't reveal another learner's rows.
  if (!row || row.learnerId !== Number(session.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(learnerStories).where(eq(learnerStories.id, storyId));
  return NextResponse.json({ ok: true });
}
