import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { parentChildren, users } from "@/db/schema";
import { getPortalSession } from "@/lib/portal-session";

export const PLAY_PROFILE_COOKIE = "ai_kids_play_profile";

/** Keep the parent's authenticated session; never impersonate a child account.
 * The cookie is only a selection, not authority: ownership and both live roles
 * are checked against the database on EVERY game page and API request. */
export async function getLearnerSession() {
  const parent = await getPortalSession();
  if (!parent || parent.role !== "parent") return null;
  const raw = (await cookies()).get(PLAY_PROFILE_COOKIE)?.value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const childId = Number(raw);
  if (!Number.isSafeInteger(childId) || childId <= 0) return null;
  const [owner] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, Number(parent.id)))
    .limit(1);
  if (owner?.role !== "parent") return null;
  const [child] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childId, users.id))
    .where(
      and(
        eq(parentChildren.parentId, Number(parent.id)),
        eq(parentChildren.childId, childId),
        eq(users.role, "learner"),
      ),
    )
    .limit(1);
  if (!child) return null;
  return {
    id: String(child.id),
    role: "learner" as const,
    name: child.name,
    email: child.email ?? "",
    parentId: parent.id,
  };
}
