import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { generateAndStoreKidImage } from "@/lib/gemini-image";

export const maxDuration = 60;

// Illustrate one Story Builder page on demand. The reader shows an emoji header
// while this loads (and if it returns null), so illustrations are a progressive
// enhancement — the story is fully readable without them. The prompt is run
// through the kid-safe templating in generateAndStoreKidImage.
const schema = z.object({
  text: z.string().min(1).max(400),
  // A short hero description ("a brave fox 🦊") repeated on every page so the
  // character looks the same throughout the story; seed pins the Flux fallback.
  characterAnchor: z.string().max(80).optional(),
  seed: z.number().int().min(0).max(4294967295).optional(),
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
  const { text, characterAnchor, seed } = parsed.data;
  const url = await generateAndStoreKidImage(text, "watercolor", `learn/story/${session.id}`, { characterAnchor, seed });
  return NextResponse.json({ url });
}
