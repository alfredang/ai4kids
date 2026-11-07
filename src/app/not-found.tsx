import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { PipMascot } from "@/components/public/PipMascot";
import { KidsIcon, type KidsIconName } from "@/components/public/KidsIcon";

export const metadata: Metadata = { title: "Page not found" };

const WAYS: { href: string; icon: KidsIconName; title: string; copy: string }[] = [
  { href: "/#workshops", icon: "bag", title: "December workshops", copy: "Stories, art, maths and science." },
  { href: "/games", icon: "wand", title: "Explore games", copy: "Parents unlock the fun." },
  { href: "/programs", icon: "book", title: "All programmes", copy: "Small live classes." },
  { href: "/contact", icon: "chat", title: "Ask our team", copy: "We’re happy to help." },
];

export default function NotFound() {
  return (
    <div className="kids-marketing">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-lost">
        <div className="kids-lost-pip" aria-hidden="true">
          <PipMascot />
        </div>
        <div>
          <p className="kids-lost-label">Page 404</p>
          <h1>
            Oops! Pip took <span>a wrong turn.</span>
          </h1>
          <p>This page has wandered off. Let’s find you another adventure.</p>
          <div className="kids-lost-ways">
            {WAYS.map((way) => (
              <Link key={way.href} href={way.href}>
                <KidsIcon name={way.icon} />
                <strong>{way.title}</strong>
                <small>{way.copy}</small>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
