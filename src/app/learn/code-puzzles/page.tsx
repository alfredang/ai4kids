import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, activityCompletions } from "@/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { CodeQuestGame } from "./CodeQuestGame";

export const dynamic = "force-dynamic";

/**
 * Which levels this learner has already cleared, derived from the completions
 * they post on each win (`metadata.level`, 1-based) and returned as 0-based
 * indices. Progress belongs to the ACCOUNT, not the browser — kids share a
 * device, so a localStorage-only tally would hand one kid another's unlocks.
 */
async function clearedLevels(learnerId: number): Promise<number[]> {
  const rows = await db
    .select({ metadata: activityCompletions.metadata })
    .from(activityCompletions)
    .innerJoin(activities, eq(activityCompletions.activityId, activities.id))
    .where(and(eq(activityCompletions.learnerId, learnerId), eq(activities.slug, "ai-coding")));

  const cleared = new Set<number>();
  for (const row of rows) {
    const level = (row.metadata as { level?: unknown } | null)?.level;
    if (typeof level === "number" && Number.isInteger(level) && level > 0) cleared.add(level - 1);
  }
  return [...cleared];
}

export default async function CodePuzzlesPage() {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn/code-puzzles");

  return <CodeQuestGame initialCleared={await clearedLevels(Number(session.id))} />;
}
