"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { KidsIcon, type KidsIconName } from "@/components/public/KidsIcon";
import { KidsLogo } from "@/components/public/KidsLogo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hasMainLandmark =
    pathname === "/" ||
    pathname === "/contact" ||
    pathname.startsWith("/holiday-workshops/");
  const links: [string, string, KidsIconName][] = [
    ["/#workshops", "December workshops", "bag"],
    ["/games", "Explore games", "wand"],
    ["/#free-tools", "Free goodies", "gift"],
  ];
  return (
    <header className="kids-site-header">
      {hasMainLandmark && (
        <a className="kids-skip-link" href="#main-content">
          Skip to content
        </a>
      )}
      <div className="kids-nav-wrap">
        <KidsLogo />
        <nav className="kids-desktop-nav" aria-label="Main navigation">
          {links.map(([href, label, icon]) => (
            <Link key={href} href={href}>
              <span className="kids-nav-emoji" aria-hidden="true">
                <KidsIcon name={icon as KidsIconName} />
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="kids-nav-actions">
          <Link href="/login?parentRequired=1" className="kids-login">
            <KidsIcon name="home" /> Family login
          </Link>
          <Link href="/#enquire" className="kids-button kids-button-small">
            Say hello! <span aria-hidden="true">↗</span>
          </Link>
          <button
            className="kids-menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="kids-mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <KidsIcon name="close" /> : <KidsIcon name="menu" />}
            <span>Menu</span>
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="kids-mobile-nav"
          className="kids-mobile-nav"
          aria-label="Mobile navigation"
        >
          {[
            ...links,
            ["/login", "Family login", "home"],
            ["/#enquire", "Say hello!", "mail"],
          ].map(([href, label, icon]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              <span className="kids-nav-emoji" aria-hidden="true">
                <KidsIcon name={icon as KidsIconName} />
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
