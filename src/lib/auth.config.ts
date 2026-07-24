import type { NextAuthConfig } from "next-auth";

// 30-day sliding session. updateAge=0 means every request re-issues the cookie
// with a fresh 30-day expiry, so an *active* admin is never logged out; an idle
// (or stolen) cookie stops working 30 days after its last use. The same maxAge
// is applied to the cookie itself so it survives browser restarts.
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const useSecureCookie = process.env.NODE_ENV === "production";
const sessionCookieName = useSecureCookie
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

// Edge-safe subset of the auth config used by middleware.
// No DB imports, no bcrypt — those only live in src/lib/auth.ts.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: THIRTY_DAYS, updateAge: 0 },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookie,
        maxAge: THIRTY_DAYS,
      },
    },
  },
  // Public sign-in is the kid/parent page; an OAuth error or any NextAuth
  // sign-in fallback lands there, NOT on the staff admin page. Admins still
  // reach /admin/login via the explicit middleware + admin-layout redirects.
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fail closed: an unknown/blank role must NOT become admin. Privilege
        // is re-verified against the DB in getAdminSession regardless.
        token.role = (user as { role?: string }).role ?? "parent";
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as string) ?? "parent";
      }
      return session;
    },
  },
};
