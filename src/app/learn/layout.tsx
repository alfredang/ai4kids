import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession, isStaff } from "@/lib/portal-session";
import { SignOutButton } from "@/components/portal/SignOutButton";

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/learn");
  if (isStaff(session.role)) redirect("/admin");
  if (session.role === "parent") redirect("/parent");

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky/10 via-cream to-coral/10">
      <header className="sticky top-0 z-40 border-b border-amber-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/learn" className="flex items-center gap-2 font-fun text-lg font-700 text-slate-800">
            <span aria-hidden>🎒</span> {session.name?.split(" ")[0] || "My"}'s Playground
          </Link>
          <nav className="flex items-center gap-5 font-fun font-600 text-slate-500">
            <Link href="/learn" className="hover:text-coral">Activities</Link>
            <Link href="/learn/leaderboard" className="hover:text-coral">🏆 Leaderboard</Link>
            <Link href="/learn/gallery" className="hover:text-coral">🖼️ My Art</Link>
            <Link href="/learn/stories" className="hover:text-coral">📚 My Stories</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
