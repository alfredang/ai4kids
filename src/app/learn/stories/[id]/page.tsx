import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getLearnerStory } from "@/lib/portal-queries";
import { SavedStoryReader } from "@/components/portal/SavedStoryReader";

export default async function StoryViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn/stories");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const story = await getLearnerStory(Number(session.id), id);
  if (!story) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/learn/stories" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to My Stories</Link>

      <div className="mt-3 rounded-[2rem] bg-gradient-to-r from-grape/20 via-cream to-coral/20 p-6">
        <h1 className="font-fun text-3xl font-700 text-slate-900">{story.title}</h1>
      </div>

      <div className="mt-5">
        <SavedStoryReader pages={story.pages} />
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/learn/storytelling" className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
          Build another 🔁
        </Link>
        <Link href="/learn/stories" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
          All my stories
        </Link>
      </div>
    </div>
  );
}
