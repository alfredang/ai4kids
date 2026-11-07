import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSessionValue } from "@/lib/admin-session";
import { getSiteBrand } from "@/lib/site-settings";
import { getAdminSession, staffRoleForUserId, canAccessRoute, type AdminRole } from "@/lib/admin-role";
import { SidebarShell, type NavItem } from "./_components/SidebarShell";

const ALL_NAV: (NavItem & { roles: AdminRole[] })[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", roles: ["admin", "editor", "author"] },
  { href: "/admin/programs", label: "Programs", icon: "categories", roles: ["admin", "editor"] },
  { href: "/admin/classes", label: "Classes", icon: "posts", roles: ["admin", "editor"] },
  { href: "/admin/bookings", label: "Bookings", icon: "leads", roles: ["admin", "editor"] },
  { href: "/admin/people", label: "Kids & Parents", icon: "users", roles: ["admin", "editor"] },
  { href: "/admin/leads", label: "Enquiries", icon: "menus", roles: ["admin", "editor"] },
  { href: "/admin/settings/portal", label: "Settings", icon: "settings", roles: ["admin", "editor"] },
  { href: "/admin/users", label: "Staff", icon: "media", roles: ["admin"] },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname =
    h.get("x-pathname") ?? h.get("next-url") ?? h.get("x-invoke-path") ?? "";
  const isLoginPage = pathname === "/admin/login" || pathname.endsWith("/admin/login");

  if (isLoginPage) return <div className="admin-shell">{children}</div>;

  const cookieStore = await cookies();
  // Two ways to hold a staff session:
  //   1. the HMAC ti_admin_session cookie minted by /api/admin/login (always admin)
  //   2. a NextAuth JWT whose role is a staff role (admin/editor/author)
  // A parent/learner shares the NextAuth cookie but is NOT staff, so we must
  // verify rather than trust mere cookie presence.
  const hmacSession = verifyAdminSessionValue(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  const [brand, hmacRole, jwtSession] = await Promise.all([
    getSiteBrand(),
    // Re-verify the HMAC cookie's role against the DB — a valid signature alone
    // is NOT enough. This rejects an admin cookie minted for a non-staff account
    // and revokes access the instant someone is demoted.
    hmacSession ? staffRoleForUserId(hmacSession.userId) : Promise.resolve(null),
    getAdminSession(),
  ]);

  if (!hmacRole && !jwtSession) {
    redirect(`/admin/login?from=${encodeURIComponent(pathname || "/admin")}`);
  }

  // Both paths are now DB-verified staff roles; the least-privilege fallback is
  // purely defensive (unreachable after the guard above).
  const role: AdminRole = hmacRole ?? jwtSession?.role ?? "author";
  const email = hmacSession?.email ?? jwtSession?.email ?? "";

  // Per-role route enforcement (defense in depth — middleware should already
  // handle this for non-admin routes, but the layout is the cleanest place
  // to redirect on a page-level basis).
  if (pathname && !canAccessRoute(role, pathname)) {
    redirect("/admin");
  }

  const items: NavItem[] = ALL_NAV.filter((n) => n.roles.includes(role)).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );

  async function signOutAction() {
    "use server";
    const jar = await cookies();
    jar.delete(ADMIN_COOKIE_NAME);
    jar.delete("authjs.session-token");
    jar.delete("__Secure-authjs.session-token");
    redirect("/admin/login");
  }

  return (
    <div className="admin-shell min-h-screen flex">
      <SidebarShell
        brand={{ shortName: brand.shortName, logoUrl: brand.logoUrl }}
        email={email}
        role={role}
        items={items}
        signOutAction={signOutAction}
      />
      <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
    </div>
  );
}
