import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getLearnerStories } from "@/lib/portal-queries";
import { DeleteStoryButton } from "@/components/portal/DeleteStoryButton";

export default async function StoriesGalleryPage() {
  // Guard here too: the layout's redirect runs in parallel with this page, so
  // it doesn't stop our session read — without this, a null session throws.
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn/stories");
  const stories = await getLearnerStories(Number(session.id));

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900">📚 My Stories</h1>
      <p className="mt-1 font-round text-slate-500">All the tales you’ve saved. Tap one to read it again.</p>

      {stories.length === 0 ? (
        <div className="mt-8 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-grape/30">
          <div className="text-5xl">📖</div>
          <p className="mt-3 font-fun font-700 text-slate-700">No stories yet!</p>
          <Link href="/learn/storytelling" className="mt-4 inline-block rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow">
            Build your first one ▶
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {stories.map((s) => {
            const cover = s.pages.find((p) => p.image)?.image ?? null;
            const coverEmojis = s.pages.find((p) => p.emojis)?.emojis ?? null;
            return (
              <figure key={s.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-grape/20">
                <Link href={`/learn/stories/${s.id}`} className="block">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={s.title} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-amber-50 to-grape/10 text-5xl">
                      {coverEmojis || "📖"}
                    </div>
                  )}
                </Link>
                <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                  <DeleteStoryButton id={s.id} />
                </div>
                <figcaption className="p-2 font-fun text-sm font-700 text-slate-700 line-clamp-2">{s.title}</figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
