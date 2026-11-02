import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import {
  getParentChildren,
  getLearnerStats,
  getRecentCompletions,
} from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function ParentHome() {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent");
  const parentId = Number(session.id);
  const kids = await getParentChildren(parentId);

  const kidCards = await Promise.all(
    kids.map(async (k) => ({
      kid: k,
      stats: await getLearnerStats(k.id),
      recent: await getRecentCompletions(k.id, 4),
    })),
  );

  return (
    <div>
      <h1 className="font-fun text-3xl font-700 text-slate-900">
        Hi {session.name?.split(" ")[0] || "there"}<PlayfulText text={"! 👋 "} /></h1>
      <p className="mt-1 font-round text-slate-500">Pick a child and explore the games together.</p>

      <Link href="/parent/play" className="mt-4 inline-block rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white">Explore our games →</Link>
      {kids.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
          <div className="text-5xl"><PlayfulText text={"🐣"} /></div>
          <p className="mt-3 font-round text-slate-600">No kids linked yet.</p>
          <Link
            href="/parent/children/new"
            className="mt-4 inline-block rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow"
          >
            + Add your child
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {kidCards.map(({ kid, stats, recent }) => (
            <div key={kid.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-amber-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky/15 text-2xl">
                  {kid.avatar ?? "🧒"}
                </div>
                <div>
                  <div className="font-fun text-lg font-700 text-slate-800">{kid.name}</div>
                  <div className="text-sm text-slate-400">
                    @{kid.username} {kid.ageGroup ? `· ages ${kid.ageGroup}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Activities" value={stats.activitiesDone} accent="text-sky-500" />
                <Stat label="Total score" value={stats.totalScore} accent="text-coral" />
                <Stat label="Badges" value={stats.badges} accent="text-amber-500" />
              </div>
              <div className="mt-4">
                <div className="font-fun font-600 text-sm text-slate-500">Recent activity</div>
                {recent.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-400"><PlayfulText text={"Nothing yet — encourage them to play! 🎮"} /></p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {recent.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm text-slate-600">
                        <span><PlayfulText text={r.activityEmoji} /> {r.activityTitle}</span>
                        <span className="font-fun font-700 text-coral">+{r.score}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl bg-amber-50/60 py-3">
      <div className={`font-fun text-2xl font-700 ${accent}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
