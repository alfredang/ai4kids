import { KidsLogo } from "@/components/public/KidsLogo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession, isStaff } from "@/lib/portal-session";
import { SignOutButton } from "@/components/portal/SignOutButton";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent");
  if (isStaff(session.role)) redirect("/admin");
  if (session.role !== "parent") redirect("/login?parentRequired=1");

  return (
    <div className="min-h-screen bg-cream">
      <header className="kids-parent-header">
        <div className="kids-wrap kids-parent-nav">
          <Link href="/parent" className="flex items-center gap-2 font-fun text-lg font-700 text-slate-800">
            <KidsLogo />
          </Link>
          <nav className="flex items-center gap-5 font-fun font-600 text-slate-500">
            <Link href="/parent" className="hover:text-coral">Home</Link>
            <Link href="/parent/play" className="hover:text-coral">Play together</Link>
            <Link href="/parent/children" className="hover:text-coral">My kids</Link>
            <Link href="/parent/bookings" className="hover:text-coral">Bookings</Link>
            <Link href="/programs" className="hover:text-coral">Book new</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
