import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/db";
import { learnerStories } from "@/db/schema";

// Persist a finished Story Builder tale to the learner's "My Stories" gallery.
// `image` may be an R2 URL or (in dev, before R2 is configured) an inline
// data-URL, so the per-image cap is generous.
const schema = z.object({
  title: z.string().min(1).max(200),
  pages: z
    .array(
      z.object({
        text: z.string().min(1).max(600),
        image: z.string().max(5_000_000).nullable().optional(),
        emojis: z.string().max(40).nullable().optional(), // Write-mode fallback illustration
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const pages = parsed.data.pages.map((p) => ({
    text: p.text,
    image: p.image ?? null,
    emojis: p.emojis ?? null,
  }));
  const [row] = await db
    .insert(learnerStories)
    .values({ learnerId: Number(session.id), title: parsed.data.title, pages })
    .returning({ id: learnerStories.id });
  return NextResponse.json({ ok: true, id: row.id });
}
