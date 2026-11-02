import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-session";
import { SignOutButton } from "@/components/portal/SignOutButton";
import { KidsLogo } from "@/components/public/KidsLogo";
import { KidsIcon } from "@/components/public/KidsIcon";
export const metadata = { robots: { index: false, follow: false } };
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const session = await getLearnerSession();
  if (!session) redirect("/parent/play");
  return <div className="kids-playground">
    <header className="kids-play-header"><div className="kids-wrap kids-play-brand"><KidsLogo /><span><KidsIcon name="sun" /> {session.name?.split(" ")[0] || "My"}’s playground</span><Link href="/parent/play">Switch child <KidsIcon name="home" /></Link></div>
      <nav className="kids-wrap kids-play-nav" aria-label="Playground navigation">
        <Link href="/learn"><KidsIcon name="bag" /> Games</Link><Link href="/learn/leaderboard"><KidsIcon name="sparkles" /> Stars</Link><Link href="/learn/gallery"><KidsIcon name="art" /> My art</Link><Link href="/learn/stories"><KidsIcon name="book" /> My stories</Link><SignOutButton />
      </nav>
    </header><main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
  </div>;
}
