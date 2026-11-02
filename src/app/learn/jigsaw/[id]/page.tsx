import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-session";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtworks } from "@/db/schema";
import { JigsawBoard } from "@/components/portal/JigsawBoard";

export const dynamic = "force-dynamic";

export default async function JigsawPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getLearnerSession();
    if (!session) redirect("/parent/play");

    const artId = Number((await params).id);
    if (!Number.isInteger(artId)) redirect("/learn/gallery");

    const [art] = await db
        .select()
        .from(learnerArtworks)
        .where(eq(learnerArtworks.id, artId))
        .limit(1);
        // Missing or not theirs → quietly back to the gallery (don't reveal others' art).
    if (!art || art.learnerId !== Number(session.id)) redirect("/learn/gallery");

    return (
      <div>
        <Link href="/learn/gallery" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to my art</Link>
        <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900"><PlayfulText text={"🧩 Puzzle Time"} /></h1>
        <p className="mt-1 font-round text-slate-500">Put “{art.prompt}” back together!</p>
        <div className="mt-5">
          <JigsawBoard imageURL={art.r2Url} artworkId={art.id} />
        </div>
      </div>
  );
}