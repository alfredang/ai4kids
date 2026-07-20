import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, activityCompletions } from "@/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { PhonicsQuest, type Stars } from "./PhonicsQuest";

export const dynamic = "force-dynamic";

/**
 * This learner's best stars per world, derived from the completions they post on
 * each run (`metadata: { world, stars }`). Progress belongs to the ACCOUNT, not
 * the browser — kids share a device, so a localStorage-only tally would hand one
 * kid another's unlocks (and lose their own on a second device).
 */
async function bestStars(learnerId: number): Promise<Stars> {
  const rows = await db
    .select({ metadata: activityCompletions.metadata })
    .from(activityCompletions)
    .innerJoin(activities, eq(activityCompletions.activityId, activities.id))
    .where(and(eq(activityCompletions.learnerId, learnerId), eq(activities.slug, "ai-phonics")));

  const best: Stars = {};
  for (const row of rows) {
    const { world, stars } = (row.metadata ?? {}) as { world?: unknown; stars?: unknown };
    if (typeof world !== "string" || typeof stars !== "number" || !Number.isFinite(stars)) continue;
    if (stars > (best[world] ?? 0)) best[world] = stars;
  }
  return best;
}

export default async function PhonicsPage() {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn/phonics");

  return <PhonicsQuest initialStars={await bestStars(Number(session.id))} />;
}
