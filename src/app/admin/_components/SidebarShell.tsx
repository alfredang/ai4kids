"use client";

import Link from "next/link";
import Image from "next/image";
import { KidsIcon } from "@/components/public/KidsIcon";
import { useEffect, useState } from "react";
import {
  HiSquares2X2,
  HiDocumentText,
  HiNewspaper,
  HiTag,
  HiHashtag,
  HiBars3,
  HiPhoto,
  HiInbox,
  HiShare,
  HiCog6Tooth,
  HiUsers,
  HiArrowRightOnRectangle,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
} from "react-icons/hi2";

const ICONS = {
  dashboard: HiSquares2X2,
  pages: HiDocumentText,
  posts: HiNewspaper,
  categories: HiTag,
  tags: HiHashtag,
  menus: HiBars3,
  media: HiPhoto,
  leads: HiInbox,
  social: HiShare,
  settings: HiCog6Tooth,
  users: HiUsers,
} as const;
type IconKey = keyof typeof ICONS;

export type NavItem = { href: string; label: string; icon: IconKey };

type Brand = { shortName: string; logoUrl: string | null };

export function SidebarShell({
  brand,
  email,
  role,
  items,
  signOutAction,
}: {
  brand: Brand;
  email: string;
  role: string;
  items: NavItem[];
  signOutAction: () => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin-sidebar-collapsed") : null;
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } shrink-0 bg-(--color-bg-elevated) border-r border-(--color-border) min-h-screen p-3 flex flex-col transition-[width] duration-200`}
      // Avoid hydration mismatch flicker: keep server-rendered width until hydrated.
      style={!hydrated ? { width: "16rem" } : undefined}
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <Link
          href="/admin"
          className="flex items-center gap-2 min-w-0"
          title={brand.shortName}
        >
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={brand.shortName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-md object-cover shrink-0"
            />
          ) : (
            <KidsIcon name="sun" className="w-8 h-8 shrink-0" />
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-bold leading-tight truncate text-sm">
                {brand.shortName}
              </div>
              <div className="text-[10px] text-white/45 font-mono uppercase truncate">
                {role || email}
              </div>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className={`${
            collapsed ? "ml-0 mt-2" : "ml-2"
          } shrink-0 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition`}
        >
          {collapsed ? (
            <HiChevronDoubleRight className="w-4 h-4" />
          ) : (
            <HiChevronDoubleLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center ${
                collapsed ? "justify-center" : "gap-3"
              } px-3 py-2 rounded-md hover:bg-white/5 text-sm text-white/85 hover:text-white transition`}
            >
              <Icon className="w-4 h-4 text-white/60 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <form action={signOutAction}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={`w-full text-left flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          } px-3 py-2 rounded-md hover:bg-white/5 text-sm text-white/65 transition`}
        >
          <HiArrowRightOnRectangle className="w-4 h-4 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </form>
    </aside>
  );
}
