import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { db } from "@/db";
import { activities, activityCompletions } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-session";
import { ESCAPE_ROOMS } from "@/lib/escape-rooms";

export const dynamic = "force-dynamic";

export default async function EscapeRoomsHub() {
  const session = await getLearnerSession();
  if (!session) redirect("/parent/play");
  const learnerId = Number(session.id);
  const slugs = ESCAPE_ROOMS.map((r) => r.activitySlug);

  // Best score per room for this learner (rooms with no play return null).
  const rows = await db
    .select({
      slug: activities.slug,
      best: sql<number | null>`max(${activityCompletions.score})`,
    })
    .from(activities)
    .leftJoin(
      activityCompletions,
      and(
        eq(activityCompletions.activityId, activities.id),
        eq(activityCompletions.learnerId, learnerId),
      ),
    )
    .where(inArray(activities.slug, slugs))
    .groupBy(activities.slug);
  const bestBySlug = new Map(rows.map((r) => [r.slug, r.best == null ? null : Number(r.best)]));

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Back to activities
      </Link>

      {/* Header banner */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-gradient-to-r from-sunny/40 to-coral/30 p-6 shadow-lg ring-1 ring-amber-100">
        <div>
          <div className="font-fun text-2xl font-700 text-slate-900"><PlayfulText text={"🗝️ AI Escape Rooms"} /></div>
          <p className="font-round text-slate-600">
            Pick a room, explore it, and solve every puzzle to break out!
          </p>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 font-fun text-sm font-700 text-amber-600 shadow-sm">
          {ESCAPE_ROOMS.length} rooms
        </span>
      </div>

      {/* Room cards */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ESCAPE_ROOMS.map((room) => {
          const best = bestBySlug.get(room.activitySlug);
          return (
            <div
              key={room.slug}
              className={`flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ${room.ring}`}
            >
              <div className="flex items-start justify-between">
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${room.accent}`}>
                  <PlayfulText text={room.emoji} />
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-fun text-xs font-700 text-amber-600 ring-1 ring-amber-100">
                  ages {room.ageRange}
                </span>
              </div>
              <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">{room.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500">{room.tagline}</p>
              <div className="mt-2 text-xs text-slate-400">
                {room.stations.length} objects ·{" "}
                {best != null ? `Your best: ${best} pts` : "Not played yet"}
              </div>
              <Link
                href={`/learn/escape-room/${room.slug}`}
                className="mt-3 rounded-full bg-coral px-4 py-2.5 text-center font-fun font-700 text-white shadow transition hover:scale-105"
              >
                {best != null ? "Play again ▶" : "Enter ▶"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
