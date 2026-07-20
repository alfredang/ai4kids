import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";
import { generateAndStoreKidImage } from "@/lib/kid-image";
import { recordCompletion } from "@/lib/activities";

export const maxDuration = 60;

const schema = z.object({ prompt: z.string().min(1).max(300) });

type Scene = { text: string; emojis: string; imagePrompt: string; image?: string };
type Story = {
  title: string;
  scenes: Scene[];
};

// Offline fallback so the activity always works in a demo.
function fallbackStory(prompt: string): Story {
  return {
    title: `The Adventure of ${prompt.slice(0, 40)}`,
    scenes: [
      { text: `Once upon a time, a brave hero set off because of ${prompt}.`, emojis: "🌅🧒✨", imagePrompt: `a brave young hero setting off on an adventure, ${prompt}` },
      { text: "Along the way they met a friendly robot who loved to help.", emojis: "🤖🤝🌟", imagePrompt: "a friendly helpful robot meeting a child on a path" },
      { text: "Together they solved the puzzle and saved the day! The end.", emojis: "🧩🎉🏆", imagePrompt: "a child and a robot celebrating after solving a puzzle" },
    ],
  };
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell me what to write about!" }, { status: 400 });

  const ageGroup = "kids";
  const story =
    (await askClaudeJson<Story>(
      `Write a short, wholesome 3-scene illustrated story for ${ageGroup} about: "${parsed.data.prompt}".
Return ONLY JSON of the form:
{"title": string, "scenes": [{"text": "2-3 simple sentences", "emojis": "2-4 emojis that illustrate the scene", "imagePrompt": "a short visual description of the scene for an illustrator — characters, setting, colours; no text in the image"}, ... exactly 3 scenes]}
Keep language simple, positive, and age-appropriate. No scary or unsafe content.`,
      { model: "haiku" },
    )) ?? fallbackStory(parsed.data.prompt);

  // Illustrate each scene with a generated image (watercolour storybook style).
  // Degrades gracefully to the emoji illustration when image-gen is unavailable.
  await Promise.all(
    story.scenes.map(async (scene) => {
      const imgPrompt = scene.imagePrompt?.trim() || scene.text;
      const url = await generateAndStoreKidImage(imgPrompt, "watercolor", `learn/story/${session.id}`);
      if (url) scene.image = url;
    }),
  );

  // Score: reward longer, complete stories (capped).
  const words = story.scenes.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  const score = Math.min(100, 40 + Math.round(words / 2));

  await recordCompletion({
    learnerId: Number(session.id),
    activitySlug: "ai-storytelling",
    score,
    metadata: { prompt: parsed.data.prompt, story },
  });

  return NextResponse.json({ story, score });
}
