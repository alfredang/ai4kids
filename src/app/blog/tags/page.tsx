import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tags, postTags } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Tags — Family Journal",
  description:
    "Browse every tag in the AI Kids family journal: stories, art, maths, science and exploring AI together.",
  alternates: { canonical: "/blog/tags" },
  openGraph: {
    type: "website",
    url: "/blog/tags",
    title: "All Tags — AI Kids Family Journal",
    description: "Every tag in our family journal.",
    locale: "en_SG",
    siteName: "AI Kids Academy",
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: "AI Kids Academy" }],
  },
};

export default async function AllTagsPage() {
  const [allTags, tagCounts] = await Promise.all([
    db.select().from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId, count: sql<number>`count(*)::int` })
      .from(postTags)
      .groupBy(postTags.tagId),
  ]);
  if (allTags.length === 0) redirect("/blog");
  const countByTagId = new Map<number, number>(tagCounts.map((r) => [r.tagId, r.count]));
  const sorted = [...allTags].sort(
    (a, b) => (countByTagId.get(b.id) ?? 0) - (countByTagId.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  );

  return (
    <>
      <Navbar />
      <main>
        <section className="relative pt-6 pb-4">
          <Container className="relative">
            <div className="kicker mb-3">Family journal · Tags</div>
            <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[1.15]">
              All <span className="gradient-text">Tags</span>
            </h1>
            <p className="mt-4 text-(--color-muted) text-lg max-w-2xl">
              {sorted.length} tags across the journal. Click any tag to filter posts.
            </p>
            <div className="mt-6">
              <Link
                href="/blog"
                className="text-sm text-(--color-cyan) hover:underline"
              >
                ← Back to all posts
              </Link>
            </div>
          </Container>
        </section>

        <section className="pb-8">
          <Container>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sorted.map((t) => {
                const count = countByTagId.get(t.id) ?? 0;
                return (
                  <Link
                    key={t.id}
                    href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                    className="kids-text-filter"
                  >
                    #{t.name}
                    <span className="ml-2 text-xs text-white/40">{count}</span>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
