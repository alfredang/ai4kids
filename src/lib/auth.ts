import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { rateLimit } from "./rate-limit";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: string } & DefaultSession["user"];
  }
}

// Learners sign in with a username, admins/staff with an email. Both arrive on
// the `identifier` field; password rule is relaxed (kids use simple passwords).
const credentialsSchema = z.object({
  identifier: z.string().min(2).max(255),
  password: z.string().min(4),
});

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      identifier: { label: "Username or Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw, request) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { identifier, password } = parsed.data;
      const id = identifier.trim().toLowerCase();
      // Brute-force throttle (same primitive as /api/admin/login): per-identifier
      // for targeted guessing, per-IP for a spray across many accounts. Returning
      // null here surfaces as a normal "invalid credentials" to the caller.
      const ip =
        request?.headers?.get("cf-connecting-ip") ||
        request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
      const WINDOW_MS = 10 * 60_000;
      const overId = !rateLimit(`login:id:${id}`, 5, WINDOW_MS);
      const overIp = ip !== null && !rateLimit(`login:ip:${ip}`, 10, WINDOW_MS);
      if (overId || overIp) return null;
      // Match by username (kids) first, then email (staff).
      const [byUsername] = await db
        .select()
        .from(users)
        .where(eq(users.username, id))
        .limit(1);
      const user =
        byUsername ??
        (
          await db.select().from(users).where(eq(users.email, id)).limit(1)
        )[0];
      if (!user || !user.passwordHash) return null;
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;
      return {
        id: String(user.id),
        email: user.email ?? undefined,
        name: user.name,
        role: user.role,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const isGoogleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // Google sign-in: existing users (admins/parents) authenticate with their
    // stored role. A brand-new Google email self-provisions a PARENT account —
    // parents onboard themselves; admins are pre-seeded and never auto-created.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (row) {
        user.id = String(row.id);
        (user as { role?: string }).role = row.role;
        return true;
      }
      // First-time parent: create the account on the fly.
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: user.name ?? email.split("@")[0],
          role: "parent",
          avatar: user.image ?? null,
        })
        .returning();
      user.id = String(created.id);
      (user as { role?: string }).role = created.role;
      return true;
    },
  },
});
