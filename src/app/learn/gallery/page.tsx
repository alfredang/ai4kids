import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-session";
import { getLearnerArtworks } from "@/lib/portal-queries";
import { DeleteArtButton } from "@/components/portal/DeleteArtButton";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ style?: string }> }) {
  // Guard here too: the layout's redirect runs in parallel with this page, so
  // it doesn't stop our session read — without this, a null session throws.
  const session = await getLearnerSession();
  if (!session) redirect("/parent/play");
  const { style } = await searchParams;
  const artworks = await getLearnerArtworks(Number(session.id), style);

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900"><PlayfulText text={"🖼️ My Art Gallery"} /></h1>
      <p className="mt-1 font-round text-slate-500">All the pictures you’ve made with AI.</p>

      {artworks.length === 0 ? (
        <div className="mt-8 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-tangerine/30">
          <div className="text-5xl"><PlayfulText text={"🎨"} /></div>
          <p className="mt-3 font-fun font-700 text-slate-700">No pictures yet!</p>
          <Link href="/learn/art" className="mt-4 inline-block rounded-full bg-tangerine px-6 py-3 font-fun font-700 text-white shadow"><PlayfulText text={" Make your first one ▶ "} /></Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {artworks.map((a) => (
            <figure key={a.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.r2Url} alt={a.prompt} className="aspect-square w-full object-cover" />
              <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                <DeleteArtButton id={a.id} />
              </div>
              <Link
                href={`/learn/jigsaw/${a.id}`}
                className="absolute bottom-9 left-2 rounded-full bg-grape/90 px-3 py-1 font-fun text-xs font-700 text-white shadow opacity-0 transition group-hover:opacity-100"
              ><PlayfulText text={" Play 🧩 "} /></Link>
              <figcaption className="p-2 font-round text-xs text-slate-500 line-clamp-2">{a.prompt}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
