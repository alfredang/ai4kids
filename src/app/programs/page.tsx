import { PlayfulText } from "@/components/public/PlaySymbol";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/db";
import { programs, classes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import {
  CATEGORIES,
  AGE_BANDS,
  CATEGORY_BY_SLUG,
  formatPrice,
} from "@/lib/portal-content";

export const dynamic = "force-dynamic";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; age?: string }>;
}) {
  const { category, age } = await searchParams;
  const ageBand = AGE_BANDS.find((b) => b.slug === age);

  const all = await db
    .select()
    .from(programs)
    .where(eq(programs.published, true))
    .catch(() => []);

  const filtered = all.filter((p) => {
    if (category && p.category !== category) return false;
    if (ageBand && (p.ageMax < ageBand.min || p.ageMin > ageBand.max))
      return false;
    return true;
  });

  // Count open classes per program for the badge.
  const openClasses = await db
    .select()
    .from(classes)
    .catch(() => []);
  const openByProgram = new Map<number, number>();
  for (const c of openClasses) {
    if (c.status === "open")
      openByProgram.set(c.programId, (openByProgram.get(c.programId) ?? 0) + 1);
  }

  return (
    <div className="kids-workshop-page min-h-screen">
      <SiteHeader />
      <div className="kids-wrap kids-catalogue">
        <div className="kids-catalogue-top">
          <div>
            <h1 className="kids-catalogue-heading">Explore programs</h1>
            <p className="kids-catalogue-intro">
              Small live classes where kids build real things with AI.
            </p>
            {/* Filters */}
            <div className="mt-3 flex flex-wrap">
              <CatalogueFilter
                href="/programs"
                active={!category && !age}
                label="All"
              />
              {CATEGORIES.map((c) => (
                <CatalogueFilter
                  key={c.slug}
                  href={`/programs?category=${c.slug}`}
                  active={category === c.slug}
                  label={`${c.emoji} ${c.title}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap">
              {AGE_BANDS.map((b) => (
                <CatalogueFilter
                  key={b.slug}
                  href={`/programs?age=${b.slug}`}
                  active={age === b.slug}
                  label={`${b.emoji} Ages ${b.slug}`}
                  subtle
                />
              ))}
            </div>
          </div>
          <Link href="/#workshops" className="kids-catalogue-promo">
            <Image
              src="/images/story-workshop-banner.webp"
              alt="Illustration of a parent and child making a storybook at a workshop"
              fill
              sizes="(max-width: 900px) 100vw, 480px"
            />
            <span>
              <strong>A December to remember, together</strong>
              Stories, art, maths and science. Peek inside →
            </span>
          </Link>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-white p-7 text-center text-slate-500 shadow-sm"><PlayfulText text={" No programs match yet — check back soon! 🐣 "} /></div>
        ) : (
          <div className="kids-catalogue-grid">
            {filtered.map((p) => {
              const cat = CATEGORY_BY_SLUG[p.category];
              const open = openByProgram.get(p.id) ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/programs/${p.slug}`}
                  className={`kids-catalogue-card ${cat?.ring ?? "ring-amber-100"}`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`kids-catalogue-tile inline-flex h-16 w-16 items-center justify-center rounded-2xl text-4xl ${cat?.accent ?? ""}`}
                    >
                      {p.emoji ?? cat?.emoji ?? "✨"}
                    </div>
                    {open > 0 && (
                      <span className="kids-catalogue-availability">
                        {open} class{open > 1 ? "es" : ""} open
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-fun text-lg font-700 text-slate-800">
                    {p.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {p.summary}
                  </p>
                  <div className="mt-3 flex items-center justify-between font-fun">
                    <span className="text-sm text-slate-400">
                      Ages {p.ageMin}–{p.ageMax}
                    </span>
                    <span className="font-700 text-coral">
                      {formatPrice(p.priceCents)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function CatalogueFilter({
  href,
  active,
  label,
  subtle,
}: {
  href: string;
  active: boolean;
  label: string;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`kids-catalogue-filter ${active ? "is-active" : ""} ${subtle ? "is-age" : ""}`}
    >
      {label}
    </Link>
  );
}
