import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { getBuddyProfile, setBuddyProfile } from "@/lib/buddy-chat";
import { BUDDY_COLORS } from "@/lib/buddy-colors";

/** The kid's buddy name + colour. */
export async function GET() {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  return NextResponse.json(await getBuddyProfile(Number(session.id)));
}

const schema = z.object({
  name: z.string().trim().max(20).optional(),
  color: z.enum(BUDDY_COLORS).optional(),
});

export async function PATCH(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") return NextResponse.json({ error: "Learners only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad profile" }, { status: 400 });

  const current = await getBuddyProfile(Number(session.id));
  const name = parsed.data.name !== undefined ? parsed.data.name || null : current.name;
  const color = parsed.data.color ?? current.color;
  await setBuddyProfile(Number(session.id), name, color);
  return NextResponse.json({ ok: true, name, color });
}
