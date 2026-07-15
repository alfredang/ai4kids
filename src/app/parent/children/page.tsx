import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getParentChildren, getLearnerStats } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent/children");
  const kids = await getParentChildren(Number(session.id));
  const withStats = await Promise.all(
    kids.map(async (k) => ({ k, s: await getLearnerStats(k.id) })),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-fun text-3xl font-700 text-slate-900">My kids</h1>
        <Link
          href="/parent/children/new"
          className="rounded-full bg-sky-500 px-5 py-2.5 font-fun font-700 text-white shadow"
        >
          + Add child
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {withStats.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">
            No kids yet. Add your first child to get them learning! 🌱
          </p>
        )}
        {withStats.map(({ k, s }) => (
          <div key={k.id} className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-100">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky/15 text-2xl">
                {k.avatar ?? "🧒"}
              </div>
              <div>
                <div className="font-fun text-lg font-700 text-slate-800">{k.name}</div>
                <div className="text-sm text-slate-400">
                  Login: <span className="font-mono">@{k.username}</span>
                  {k.ageGroup ? ` · ages ${k.ageGroup}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right font-fun">
                <div className="text-coral font-700">{s.totalScore} pts</div>
                <div className="text-xs text-slate-400">{s.activitiesDone} activities</div>
              </div>
              <Link
                href={`/parent/buddy/${k.id}`}
                className="rounded-full bg-sky/15 px-4 py-2 font-fun text-sm font-700 text-sky-600 transition hover:bg-sky/25"
              >
                💬 Buddy chats
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
