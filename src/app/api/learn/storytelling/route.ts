import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearnerSession } from "@/lib/learner-session";
import { askKidsJson } from "@/lib/kids-ai";
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
    title: "The Friendly Robot’s Adventure",
    scenes: [
      { text: "Once upon a time, a brave hero set off to find a rainbow.", emojis: "🌅🧒✨", imagePrompt: "a brave young hero setting off on a rainbow adventure" },
      { text: "Along the way they met a friendly robot who loved to help.", emojis: "🤖🤝🌟", imagePrompt: "a friendly helpful robot meeting a child on a path" },
      { text: "Together they solved the puzzle and saved the day! The end.", emojis: "🧩🎉🏆", imagePrompt: "a child and a robot celebrating after solving a puzzle" },
    ],
  };
}

export async function POST(req: Request) {
  const session = await getLearnerSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "A parent must sign in and choose their child before playing." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell me what to write about!" }, { status: 400 });

  const ageGroup = "kids";
  const storySchema = z.object({ title: z.string().min(1).max(200), scenes: z.array(z.object({ text: z.string().min(1).max(1500), emojis: z.string().max(80), imagePrompt: z.string().max(1000) })).length(3) });
  const candidate =
    (await askKidsJson<Story>(
      `Write a short, wholesome 3-scene illustrated story for ${ageGroup} about: "${parsed.data.prompt}".
Return ONLY JSON of the form:
{"title": string, "scenes": [{"text": "2-3 simple sentences", "emojis": "2-4 emojis that illustrate the scene", "imagePrompt": "a short visual description of the scene for an illustrator — characters, setting, colours; no text in the image"}, ... exactly 3 scenes]}
Keep language simple, positive, and age-appropriate. No scary or unsafe content.`,
      { model: "haiku" },
    ));
  const checked = storySchema.safeParse(candidate);
  const story: Story = checked.success ? checked.data : fallbackStory(parsed.data.prompt);

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
