import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getLearnerSession } from "@/lib/learner-session";
import { db } from "@/db";
import { learnerArtworks } from "@/db/schema";
import { getR2Config, deleteFromR2 } from "@/lib/r2";

/** Delete one of the learner's own gallery pictures. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const artId = Number((await params).id);
  if (!Number.isInteger(artId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(learnerArtworks)
    .where(eq(learnerArtworks.id, artId))
    .limit(1);
  // 404 (not 403) when it isn't theirs — don't reveal another learner's rows.
  if (!row || row.learnerId !== Number(session.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove the stored object too (data-URL fallbacks have nothing to delete).
  if (!row.r2Url.startsWith("data:")) {
    const cfg = await getR2Config();
    if (cfg && row.r2Url.startsWith(cfg.publicUrl)) {
      const key = row.r2Url.slice(cfg.publicUrl.length + 1);
      try {
        await deleteFromR2(cfg, key);
      } catch (e) {
        console.error("[art] R2 delete failed", e);
      }
    }
  }

  await db.delete(learnerArtworks).where(eq(learnerArtworks.id, artId));
  return NextResponse.json({ ok: true });
}
