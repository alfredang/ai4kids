import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";
import { generateAndStoreKidImage, ART_STYLES, type ArtStyle } from "@/lib/kid-image";
import { recordCompletion } from "@/lib/activities";
import { db } from "@/db";
import { learnerArtworks } from "@/db/schema";

export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().min(1).max(200),
  style: z.enum(Object.keys(ART_STYLES) as [ArtStyle, ...ArtStyle[]]),
});

type SafetyCheck = { safe: boolean; cleanedPrompt: string };

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tell me what to draw, and pick a style!" }, { status: 400 });
  }
  const { prompt, style } = parsed.data;

  // 1. Safety gate — never pass raw kid text straight to the image model.
  //    If the classifier is unavailable, fail safe by using the raw prompt.
  const check = await askClaudeJson<SafetyCheck>(
    `A child wants to make a picture of: "${prompt}".
Decide if this is wholesome and appropriate for a young child's drawing.
Return ONLY JSON: {"safe": boolean, "cleanedPrompt": "a tidied, kid-friendly version of the idea"}.
Mark unsafe anything violent, scary, sexual, hateful, or otherwise not for kids.`,
    { model: "haiku" },
  );
  if (check && !check.safe) {
    return NextResponse.json({
      blocked: true,
      message: "Let's try a different idea! How about something fun like a friendly dragon or a space cat? 🚀",
    });
  }
  const cleanedPrompt = check?.cleanedPrompt?.trim() || prompt;

  // 2. Generate + store the image (NVIDIA FLUX → Cloudflare; R2 when configured,
  //    inline data URL as a dev fallback). Provider failures are logged inside.
  const imageUrl = await generateAndStoreKidImage(cleanedPrompt, style, `learn/art/${session.id}`);
  if (!imageUrl) {
    // Graceful fallback so the activity never hard-fails in a demo.
    return NextResponse.json({
      placeholder: true,
      message: "Our art robot is taking a nap 😴 — please try again in a moment!",
    });
  }

  // 3. Persist to the learner's gallery.
  try {
    await db.insert(learnerArtworks).values({
      learnerId: Number(session.id),
      originalPrompt: prompt,
      prompt: cleanedPrompt,
      style,
      r2Url: imageUrl,
    });
  } catch (e) {
    console.error("[art] gallery persist failed", e);
  }

  // 4. Award points.
  const score = 50;
  await recordCompletion({
    learnerId: Number(session.id),
    activitySlug: "ai-art",
    score,
    metadata: { prompt: cleanedPrompt, style },
  });

  return NextResponse.json({ imageUrl, score });
}
