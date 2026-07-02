import Link from "next/link";
import { db } from "@/db";
import { activities, activityCompletions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getLearnerStats, getLearnerBadges } from "@/lib/portal-queries";
import { CATEGORY_BY_SLUG } from "@/lib/portal-content";
import { ESCAPE_ROOMS } from "@/lib/escape-rooms";

export const dynamic = "force-dynamic";

// Which activity slugs have a real playable route.
const LIVE_ROUTES: Record<string, string> = {
  "ai-storytelling": "/learn/storytelling",
  "ai-art": "/learn/art",
  "ai-phonics": "/learn/phonics",
  "ai-buddy": "/learn/buddy",
  // Each sample escape room is its own activity, routed by room slug.
  ...Object.fromEntries(
    ESCAPE_ROOMS.map((r) => [r.activitySlug, `/learn/escape-room/${r.slug}`]),
  ),
};

export default async function LearnHome() {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn");
  const learnerId = Number(session.id);

  const [all, stats, badges] = await Promise.all([
    db.select().from(activities).orderBy(activities.sortOrder),
    getLearnerStats(learnerId),
    getLearnerBadges(learnerId),
  ]);

  // Best score per activity for this learner.
  const best = await db
    .select({
      activityId: activityCompletions.activityId,
      best: sql<number>`max(${activityCompletions.score})::int`,
    })
    .from(activityCompletions)
    .where(eq(activityCompletions.learnerId, learnerId))
    .groupBy(activityCompletions.activityId);
  const bestById = new Map(best.map((b) => [b.activityId, b.best]));

  // Escape rooms collapse into a single tile (emitted at the first one).
  const escapeRooms = all.filter((a) => a.category === "escape-room");
  const escapePlayed = escapeRooms.filter((a) => bestById.get(a.id) != null).length;

  // Card games (free-games category) likewise collapse into one tile.
  const cardGames = all.filter((a) => a.category === "free-games");
  const cardPlayed = cardGames.filter((a) => bestById.get(a.id) != null).length;

  // "Coming soon" (sneak-peek) tiles sink to the bottom of the grid. Hubs
  // (escape-room/free-games) and jigsaw aren't sneak-peeks. Stable sort keeps
  // each group's original sortOrder.
  const isComingSoon = (a: (typeof all)[number]) =>
    a.category !== "escape-room" &&
    a.category !== "free-games" &&
    a.slug !== "ai-jigsaw" &&
    !(a.live && LIVE_ROUTES[a.slug]);
  const ordered = [...all].sort((x, y) => Number(isComingSoon(x)) - Number(isComingSoon(y)));

  return (
    <div>
      {/* Stat banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-gradient-to-r from-grape to-bubble p-6 text-white shadow-lg">
        <div>
          <div className="font-fun text-2xl font-700">Welcome back, {session.name?.split(" ")[0]}! 🌟</div>
          <div className="font-round text-white/90">Pick an activity and earn points.</div>
        </div>
        <div className="flex gap-6 text-center font-fun">
          <div><div className="text-3xl font-700">{stats.totalScore}</div><div className="text-xs text-white/80">points</div></div>
          <div><div className="text-3xl font-700">{stats.activitiesDone}</div><div className="text-xs text-white/80">activities</div></div>
          <div><div className="text-3xl font-700">{stats.badges}</div><div className="text-xs text-white/80">badges</div></div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.title} title={b.description ?? ""} className="rounded-full bg-white px-3 py-1 font-fun font-600 text-sm text-slate-700 shadow-sm ring-1 ring-amber-100">
              {b.emoji} {b.title}
            </span>
          ))}
        </div>
      )}

      {/* Activity cards */}
      <h2 className="mt-8 font-fun text-2xl font-700 text-slate-900">Activities</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.flatMap((a) => {
          // Bunch all escape rooms into one tile, emitted at the first one.
          if (a.category === "escape-room") {
            return a.id === escapeRooms[0]?.id ? [<EscapeRoomsTile key="escape-hub" count={escapeRooms.length} played={escapePlayed} />] : [];
          }

          // Bunch all card games into one tile, emitted at the first one.
          if (a.category === "free-games") {
            return a.id === cardGames[0]?.id ? [<CardGamesTile key="cards-hub" count={cardGames.length} played={cardPlayed} />] : [];
          }
          
          if (a.slug === "ai-jigsaw") return []; // launched from Art Studio

          const cat = CATEGORY_BY_SLUG[a.category];
          const route = LIVE_ROUTES[a.slug];
          const playable = a.live && route;
          const myBest = bestById.get(a.id);
          return [
            <div
              key={a.id}
              className={`flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ${cat?.ring ?? "ring-amber-100"}`}
            >
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${cat?.accent ?? ""}`}>
                {a.emoji ?? cat?.emoji ?? "✨"}
              </div>
              <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">{a.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500">{a.description}</p>
              <div className="mt-2 text-xs text-slate-400">
                {myBest != null ? `Your best: ${myBest} pts` : "Not played yet"}
              </div>
              {playable ? (
                <Link
                  href={route}
                  className="mt-3 rounded-full bg-coral px-4 py-2.5 text-center font-fun font-700 text-white shadow transition hover:scale-105"
                >
                  Play ▶
                </Link>
              ) : (
                <Link
                  href={`/learn/coming-soon?slug=${a.slug}&title=${encodeURIComponent(a.title)}&emoji=${encodeURIComponent(a.emoji ?? cat?.emoji ?? "✨")}`}
                  className="mt-3 rounded-full bg-slate-100 px-4 py-2.5 text-center font-fun font-600 text-slate-500"
                >
                  Sneak peek 👀
                </Link>
              )}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

/** A single tile on /learn that groups the Brain Arcade card games and links to their hub. */
function CardGamesTile({ count, played }: { count: number; played: number }) {
  const cat = CATEGORY_BY_SLUG["free-games"];
  return (
    <Link
      href="/learn/cards"
      className={`group flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ${cat.ring} transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${cat.accent}`}>
          {cat.emoji}
        </div>
        <span className="rounded-full bg-bubble/10 px-2.5 py-1 font-fun text-xs font-700 text-bubble ring-1 ring-bubble/20">
          {count} games
        </span>
      </div>
      <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">Brain Arcade</h3>
      <p className="mt-1 flex-1 text-sm text-slate-500">
        Quick card games, play solo or with friends.
      </p>
      <div className="mt-2 text-xs text-slate-400">
        {played > 0 ? `${played} of ${count} games played` : "Not played yet"}
      </div>
      <span className="mt-3 rounded-full bg-coral px-4 py-2.5 text-center font-fun font-700 text-white shadow transition group-hover:scale-105">
        Play ▶
      </span>
    </Link>
  );
}

/** A single tile on /learn that groups all the escape rooms and links to their hub. */
function EscapeRoomsTile({ count, played }: { count: number; played: number }) {
  const cat = CATEGORY_BY_SLUG["escape-room"];
  return (
    <Link
      href="/learn/escape-room"
      className={`group flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ${cat.ring} transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${cat.accent}`}>
          {cat.emoji}
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-fun text-xs font-700 text-amber-600 ring-1 ring-amber-100">
          {count} rooms
        </span>
      </div>
      <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">{cat.title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-500">{cat.blurb}</p>
      <div className="mt-2 text-xs text-slate-400">
        {played > 0 ? `${played} of ${count} rooms explored` : "Not explored yet"}
      </div>
      <span className="mt-3 rounded-full bg-coral px-4 py-2.5 text-center font-fun font-700 text-white shadow transition group-hover:scale-105">
        Enter ▶
      </span>
    </Link>
  );
}
