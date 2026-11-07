import Link from "next/link";
import { PipMascot } from "@/components/public/PipMascot";
import { KidsIcon } from "@/components/public/KidsIcon";
import { db } from "@/db";
import { posts, categories, tags, postTags } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

/** Fallback teaser: strip HTML from contentHtml and trim to ~200 chars. */
function snippetFromHtml(html: string | null | undefined, max = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export const metadata: Metadata = {
  title: "Family Journal",
  description:
    "Little ideas for exploring AI with your child: stories, art, maths and science to try together, from the AI Kids Academy team in Singapore.",
  keywords:
    "AI for kids Singapore, parent child AI activities, AI learning for children, school holiday activities Singapore",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: "/blog",
    title: "Family Journal | AI Kids Academy",
    description: "Little ideas for exploring AI with your child.",
    locale: "en_SG",
    siteName: "AI Kids Academy",
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: "AI Kids Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Family Journal | AI Kids Academy",
    description: "Little ideas for exploring AI with your child.",
    images: ["/icon-192.png"],
  },
};
type SearchParams = Promise<{
  category?: string;
  tag?: string;
  page?: string;
  q?: string;
}>;

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const selectedCategory = sp.category?.trim() || null;
  const selectedTag = sp.tag?.trim() || null;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [allCategories, allTags, tagCounts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId, count: sql<number>`count(*)::int` })
      .from(postTags)
      .groupBy(postTags.tagId),
  ]);

  const countByTagId = new Map<number, number>(tagCounts.map((r) => [r.tagId, r.count]));
  const TOP_TAG_LIMIT = 10;
  const topTags = [...allTags]
    .sort(
      (a, b) =>
        (countByTagId.get(b.id) ?? 0) - (countByTagId.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, TOP_TAG_LIMIT);
  const displayedTags = (() => {
    if (!selectedTag) return topTags;
    if (topTags.some((t) => t.slug === selectedTag)) return topTags;
    const sel = allTags.find((t) => t.slug === selectedTag);
    return sel ? [...topTags, sel] : topTags;
  })();

  // Build set of post IDs that match the selected tag, if any.
  let allowedPostIds: number[] | null = null;
  if (selectedTag) {
    const tagRow = allTags.find((t) => t.slug === selectedTag);
    if (!tagRow) allowedPostIds = [];
    else {
      const rows = await db
        .select({ postId: postTags.postId })
        .from(postTags)
        .where(eq(postTags.tagId, tagRow.id));
      allowedPostIds = rows.map((r) => r.postId);
      if (allowedPostIds.length === 0) allowedPostIds = [-1];
    }
  }

  // Compose WHERE clauses.
  const where = [eq(posts.status, "published")];
  if (selectedCategory) {
    const catRow = allCategories.find((c) => c.slug === selectedCategory);
    if (catRow) where.push(eq(posts.categoryId, catRow.id));
    else where.push(eq(posts.id, -1)); // unknown category → empty result
  }
  if (allowedPostIds) where.push(inArray(posts.id, allowedPostIds));
  if (q) {
    const like = `%${q}%`;
    const matchesText = or(
      ilike(posts.title, like),
      ilike(posts.excerpt, like),
      ilike(posts.contentHtml, like),
      ilike(posts.slug, like),
    );
    if (matchesText) where.push(matchesText);
  }

  const allMatching = await db
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.publishedAt));
  const total = allMatching.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const items = allMatching.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function filterHref(next: {
    category?: string | null;
    tag?: string | null;
    page?: number;
    q?: string | null;
  }) {
    const params = new URLSearchParams();
    const c = next.category === undefined ? selectedCategory : next.category;
    const t = next.tag === undefined ? selectedTag : next.tag;
    const query = next.q === undefined ? q : next.q;
    if (c) params.set("category", c);
    if (t) params.set("tag", t);
    if (query) params.set("q", query);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  }

  return (
    <>
      <Navbar />
      <main>
        <section className="relative pt-6 pb-4">
          <Container className="relative">
            <div className="kicker mb-3">Family journal</div>
            <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[1.15]">
              Little ideas for <span className="gradient-text">curious families</span>.
            </h1>
            <p className="mt-3 text-(--color-muted) text-lg">
              Stories, art, maths and science to explore with your child, and what we learn along the way.
            </p>
          </Container>
        </section>

        {/* Filters */}
        {(total > 0 || q || allCategories.length > 0) && <section className="pb-4">
          <Container>
            <div className="glass p-5 space-y-4">
              <form method="get" action="/blog" className="flex flex-wrap items-center gap-2">
                {selectedCategory && (
                  <input type="hidden" name="category" value={selectedCategory} />
                )}
                {selectedTag && <input type="hidden" name="tag" value={selectedTag} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search posts by title, excerpt, or content…"
                  aria-label="Search posts"
                  className="flex-1 min-w-[220px] px-4 py-2.5 text-sm rounded-md bg-white/3 border border-white/10 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition placeholder:text-white/35"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 text-sm rounded-md bg-(--color-cyan)/15 border border-(--color-cyan)/40 text-(--color-cyan) hover:bg-(--color-cyan)/25 transition"
                >
                  Search
                </button>
                {q && (
                  <Link
                    href={filterHref({ q: null, page: 1 })}
                    className="px-4 py-2.5 text-sm rounded-md text-white/60 hover:text-white border border-white/10"
                  >
                    Clear
                  </Link>
                )}
              </form>
              <div>
                <div className="kicker mb-2">Categories</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <Link
                    href={filterHref({ category: null, page: 1 })}
                    className={`kids-text-filter ${!selectedCategory ? "is-active" : ""}`}
                  >
                    All
                  </Link>
                  {allCategories.map((c) => (
                    <Link
                      key={c.id}
                      href={filterHref({ category: c.slug, page: 1 })}
                      className={`kids-text-filter ${selectedCategory === c.slug ? "is-active" : ""}`}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <div className="kicker mb-2">Tags</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <Link
                      href={filterHref({ tag: null, page: 1 })}
                      className={`kids-text-filter ${!selectedTag ? "is-active" : ""}`}
                    >
                      All
                    </Link>
                    {displayedTags.map((t) => (
                      <Link
                        key={t.id}
                        href={filterHref({ tag: t.slug, page: 1 })}
                        className={`kids-text-filter ${selectedTag === t.slug ? "is-active" : ""}`}
                      >
                        #{t.name}
                      </Link>
                    ))}
                    {allTags.length > TOP_TAG_LIMIT && (
                      <Link
                        href="/blog/tags"
                        className="kids-text-filter"
                      >
                        See all {allTags.length} tags →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-(--color-muted) font-mono">
                {total} post{total === 1 ? "" : "s"}
                {q ? ` matching "${q}"` : ""} · page {safePage} of {totalPages}
              </p>
            </div>
          </Container>
        </section>}

        <section className="pb-8 pt-2">
          <Container>
            {items.length === 0 ? (
              <div className="kids-journal-empty">
                <PipMascot />
                <div>
                  <h2>{q ? "Pip couldn’t find that one." : "Our first stories are on the way!"}</h2>
                  <p>While you wait, peek at our December workshops or try a free family activity.</p>
                  <Link className="kids-button" href="/#workshops">
                    See December workshops <KidsIcon name="arrow" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((p) => (
                  <Link
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    className="card-hover glass overflow-hidden flex flex-col group"
                  >
                    <div className="aspect-[16/10] overflow-hidden bg-(--color-bg-deeper) relative">
                      {p.featuredImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.featuredImage}
                          alt={p.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-(--color-purple)/30 to-(--color-cyan)/20 flex items-center justify-center">
                          <span className="font-mono text-xs text-white/30">{p.slug}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        {p.publishedAt ? (
                          <div className="kicker">
                            {new Date(p.publishedAt)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                              .replace(/\//g, "-")}
                          </div>
                        ) : (
                          <span />
                        )}
                        <span
                          className="inline-flex items-center gap-1 text-xs font-mono text-(--color-muted)"
                          title={`${p.likeCount ?? 0} like${(p.likeCount ?? 0) === 1 ? "" : "s"}`}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="w-3.5 h-3.5 fill-(--color-purple)/70"
                          >
                            <path d="M12 21s-7.5-4.6-10-9.3C.4 8.2 2.4 4 6.3 4c2 0 3.4 1 4.4 2.4l1.3 1.8 1.3-1.8C14.3 5 15.7 4 17.7 4c3.9 0 5.9 4.2 4.3 7.7C19.5 16.4 12 21 12 21z" />
                          </svg>
                          {p.likeCount ?? 0}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-(--color-cyan) transition mb-2 leading-tight">
                        {p.title}
                      </h3>
                      {(() => {
                        const teaser = p.excerpt || snippetFromHtml(p.contentHtml);
                        return teaser ? (
                          <p className="text-sm text-(--color-muted) line-clamp-3 leading-relaxed">
                            {teaser}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                {safePage > 1 && (
                  <Link
                    href={filterHref({ page: safePage - 1 })}
                    className="px-4 py-2 rounded-md border border-white/10 bg-white/3 text-sm hover:border-(--color-cyan)/40 hover:text-(--color-cyan) transition"
                  >
                    ← Previous
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={filterHref({ page: n })}
                    className={`px-3 py-2 rounded-md border text-sm font-mono transition ${
                      n === safePage
                        ? "bg-(--color-cyan)/15 border-(--color-cyan)/40 text-(--color-cyan)"
                        : "bg-white/3 border-white/10 text-white/70 hover:text-white hover:border-white/30"
                    }`}
                  >
                    {n}
                  </Link>
                ))}
                {safePage < totalPages && (
                  <Link
                    href={filterHref({ page: safePage + 1 })}
                    className="px-4 py-2 rounded-md border border-white/10 bg-white/3 text-sm hover:border-(--color-cyan)/40 hover:text-(--color-cyan) transition"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
