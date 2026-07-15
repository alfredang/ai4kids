/**
 * Talking Buddy chat persistence — cross-session memory + parent review.
 *
 * Every turn is logged. A child's "new chat" only moves the `clearedAt` marker
 * (resets the buddy's context + the child's view); it never deletes rows, so a
 * parent always sees the full transcript.
 */
import { db } from "@/db";
import { learnerBuddyMessages, learnerBuddyMeta } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export type BuddyMsg = { role: "user" | "buddy"; content: string };

export async function saveBuddyMessage(learnerId: number, role: "user" | "buddy", content: string) {
  await db.insert(learnerBuddyMessages).values({ learnerId, role, content });
}

/**
 * Messages since the last "new chat", oldest → newest. Used for the buddy's
 * LLM context (small limit) and for restoring the child's view (larger limit).
 *
 * The clear boundary is compared entirely in SQL (subquery) so both timestamps
 * stay in the DB's frame — avoids JS Date / timezone mismatches.
 */
export async function getBuddyHistory(learnerId: number, limit = 50): Promise<BuddyMsg[]> {
  const rows = await db
    .select({ role: learnerBuddyMessages.role, content: learnerBuddyMessages.content })
    .from(learnerBuddyMessages)
    .where(
      and(
        eq(learnerBuddyMessages.learnerId, learnerId),
        sql`${learnerBuddyMessages.createdAt} > coalesce((select ${learnerBuddyMeta.clearedAt} from ${learnerBuddyMeta} where ${learnerBuddyMeta.learnerId} = ${learnerId}), to_timestamp(0))`,
      ),
    )
    .orderBy(desc(learnerBuddyMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ role: r.role as "user" | "buddy", content: r.content }));
}

/** Start a fresh chat thread: resets context + view but keeps the log. */
export async function clearBuddyChat(learnerId: number) {
  await db
    .insert(learnerBuddyMeta)
    .values({ learnerId, clearedAt: sql`now()` })
    .onConflictDoUpdate({ target: learnerBuddyMeta.learnerId, set: { clearedAt: sql`now()` } });
}

export type BuddyProfile = { name: string | null; color: string | null };

export async function getBuddyProfile(learnerId: number): Promise<BuddyProfile> {
  const [row] = await db
    .select({ name: learnerBuddyMeta.buddyName, color: learnerBuddyMeta.buddyColor })
    .from(learnerBuddyMeta)
    .where(eq(learnerBuddyMeta.learnerId, learnerId))
    .limit(1);
  return { name: row?.name ?? null, color: row?.color ?? null };
}

/** Upsert the kid's buddy name/colour without disturbing the clear marker. */
export async function setBuddyProfile(learnerId: number, name: string | null, color: string | null) {
  await db
    .insert(learnerBuddyMeta)
    .values({ learnerId, buddyName: name, buddyColor: color })
    .onConflictDoUpdate({ target: learnerBuddyMeta.learnerId, set: { buddyName: name, buddyColor: color } });
}

/** The FULL log for parent review (ignores clears), oldest → newest. */
export async function getBuddyTranscript(
  learnerId: number,
  limit = 500,
): Promise<(BuddyMsg & { createdAt: Date })[]> {
  const rows = await db
    .select()
    .from(learnerBuddyMessages)
    .where(eq(learnerBuddyMessages.learnerId, learnerId))
    .orderBy(asc(learnerBuddyMessages.createdAt))
    .limit(limit);
  return rows.map((r) => ({ role: r.role as "user" | "buddy", content: r.content, createdAt: r.createdAt }));
}
