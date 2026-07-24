/**
 * Admin guard for API routes. True ONLY for staff (admin/editor/author).
 *
 * Two valid paths:
 *   1. our own HMAC-signed admin cookie, minted by /api/admin/login — signed by
 *      AUTH_SECRET, so presence+signature alone proves a staff login; or
 *   2. a NextAuth session whose role (re-checked against the DB) is a staff role.
 *
 * IMPORTANT: cookie *presence* is NOT sufficient. Parents and learners share the
 * same NextAuth session-token cookie, so the previous presence-only check let
 * them call admin-only routes (credentials vault, uploads, AI assist). The role
 * check below is the fix. `getAdminSession` uses `next-auth/jwt#getToken` (the
 * reliable decode path — it was `auth()` that was flaky), not the bare `auth()`.
 */
import { cookies } from "next/headers";

import { verifyAdminSessionValue, ADMIN_COOKIE_NAME } from "./admin-session";
import { getAdminSession, staffRoleForUserId, type AdminRole } from "./admin-role";

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  // Strong path: verify the HMAC signature on our own admin cookie.
  const ours = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (ours && verifyAdminSessionValue(ours)) return true;
  // Otherwise require a NextAuth session that resolves to a staff role.
  return (await getAdminSession()) !== null;
}

/**
 * Resolve the caller's DB-verified staff role, or null if they're not staff.
 * Works for both session paths: the HMAC admin cookie (role re-read from the
 * DB, never trusted from the signature alone) and the NextAuth JWT.
 */
export async function currentStaffRole(): Promise<AdminRole | null> {
  const jar = await cookies();
  const ours = jar.get(ADMIN_COOKIE_NAME)?.value;
  const hmac = verifyAdminSessionValue(ours);
  if (hmac) return staffRoleForUserId(hmac.userId);
  const session = await getAdminSession();
  return session?.role ?? null;
}

/**
 * Guard for admin **server actions**. The admin layout only guards page
 * *renders* — a server action executes independently of layout rendering, so
 * without this call the action's side effects run even for an unauthenticated
 * request. Throws (aborting the action) when the caller isn't staff.
 */
export async function requireStaff(): Promise<AdminRole> {
  const role = await currentStaffRole();
  if (!role) throw new Error("Unauthorized");
  return role;
}

/** Like requireStaff, but restricts to the `admin` role (e.g. staff management). */
export async function requireAdminRole(): Promise<void> {
  const role = await currentStaffRole();
  if (role !== "admin") throw new Error("Forbidden");
}
