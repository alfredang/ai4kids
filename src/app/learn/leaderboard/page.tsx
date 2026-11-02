import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-session";
import { getGlobalLeaderboard } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const session = await getLearnerSession();
  if (!session) redirect("/parent/play");
  const rows = await getGlobalLeaderboard(20);
  const meId = Number(session.id);

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900"><PlayfulText text={"🏆 Leaderboard"} /></h1>
      <p className="mt-1 font-round text-slate-500">Top explorers across all games with leaderboards on.</p>

      <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-amber-100">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-slate-500"><PlayfulText text={"No scores yet — be the first to play! 🎮"} /></div>
        ) : (
          <ul>
            {rows.map((r, i) => {
              const isMe = r.learnerId === meId;
              return (
                <li
                  key={r.learnerId}
                  className={`flex items-center justify-between px-5 py-3 ${i % 2 ? "bg-amber-50/40" : ""} ${isMe ? "ring-2 ring-coral/40" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-fun text-lg font-700 text-slate-400">
                      {MEDALS[i] ?? i + 1}
                    </span>
                    <span className="text-2xl">{r.avatar ?? "🧒"}</span>
                    <span className="font-fun font-600 text-slate-700">
                      {r.name}
                      {isMe && <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-xs text-coral">You</span>}
                    </span>
                  </div>
                  <span className="font-fun text-lg font-700 text-coral">{r.total} pts</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
