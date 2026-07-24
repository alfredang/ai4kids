/**
 * Admin login — sets the custom HMAC-signed session cookie. Runs alongside
 * NextAuth's own login so the admin chrome (which uses cookie-presence) sees
 * a stable cookie even when NextAuth's JWT cookie hiccups.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ADMIN_COOKIE_NAME, adminCookieOptions, mintAdminSessionValue } from "@/lib/admin-session";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// Brute-force throttle. Two windows so neither a single-account guess nor a
// spray from one host can grind through bcrypt: per-IP (spray) and per-email
// (targeted). In-memory + per-process — resets on redeploy, same as the rest
// of the app's rate limiting — enough to defeat online password guessing.
const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 5;

function clientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const ip = clientIp(req);
  const emailKey = email.trim().toLowerCase();
  // Count every attempt (not just failures) — simplest and still lets a real
  // admin retry a few times. 429 is deliberately generic. The per-IP window is
  // only enforced when a real client IP is present, so a missing forwarded
  // header can't collapse every login into one shared bucket.
  const overEmail = !rateLimit(`login:email:${emailKey}`, MAX_PER_EMAIL, WINDOW_MS);
  const overIp = ip !== null && !rateLimit(`login:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (overEmail || overIp) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  // Staff only. Parents/learners have passwords too (kid logins, Google parents
  // who set one), so a valid password is NOT enough to mint an admin cookie.
  // Same generic message so this doesn't reveal whether the account exists.
  const STAFF_ROLES = ["admin", "editor", "author"];
  if (!STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const value = mintAdminSessionValue(user.id, user.email ?? email);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, value, adminCookieOptions());

  return NextResponse.json({ ok: true });
}
