import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { posts, categories, tags, postTags, redirects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { LikeButton } from "@/components/blog/LikeButton";
import { KidsIcon } from "@/components/public/KidsIcon";
import type { Metadata } from "next";

function formatDateDMY(d: Date | null | undefined): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
}

export const dynamic = "force-dynamic";

function stripLeadingImage(html: string, featuredImage: string | null | undefined): string {
  if (!html) return "";
  const match = html.match(/^\s*(?:<p[^>]*>\s*)?<img[^>]*src=["']([^"']+)["'][^>]*>\s*(?:<\/p>)?/i);
  if (!match) return html;
  const src = match[1];
  if (featuredImage && src !== featuredImage) return html;
  return html.slice(match[0].length);
}

function splitIntroSection(html: string): { intro: string; rest: string } {
  if (!html) return { intro: "", rest: "" };
  // Prefer splitting at the second heading. If only one heading exists, split
  // at the first heading that follows a paragraph. Otherwise pull the first
  // paragraph as the intro/overview.
  const headingRe = /<h[1-6][^>]*>/gi;
  const headings = [...html.matchAll(headingRe)];
  if (headings.length >= 2) {
    const splitAt = headings[1].index ?? 0;
    return { intro: html.slice(0, splitAt), rest: html.slice(splitAt) };
  }
  // Take the first paragraph (and any preceding heading) as intro.
  const firstP = html.match(/<p[^>]*>[\s\S]*?<\/p>/i);
  if (firstP && firstP.index !== undefined) {
    const end = firstP.index + firstP[0].length;
    return { intro: html.slice(0, end), rest: html.slice(end) };
  }
  return { intro: "", rest: html };
}

async function getPost(slug: string) {
  const [p] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);
  return p;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  const canonical = post.canonicalUrl ?? `/blog/${post.slug}`;
  const ogImage = post.ogImage ?? post.featuredImage ?? "/icon-192.png";
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    keywords: post.seoKeywords ?? undefined,
    alternates: { canonical },
    robots: post.noIndex ? { index: false } : undefined,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      images: [ogImage],
      type: "article",
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      locale: "en_SG",
      siteName: "Tertiary Infotech Academy",
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      images: [ogImage],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    // Honour the redirects table (e.g. a renamed post slug) before 404'ing.
    const [redir] = await db
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, `/blog/${slug}`))
      .limit(1);
    if (redir) redirect(redir.toPath);
    notFound();
  }

  // Pull the post's category + tag chips for the header meta row.
  const [category, tagRows] = await Promise.all([
    post.categoryId
      ? db
          .select({ slug: categories.slug, name: categories.name })
          .from(categories)
          .where(eq(categories.id, post.categoryId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ slug: tags.slug, name: tags.name })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(eq(postTags.postId, post.id)),
  ]);

  const bodyHtml = stripLeadingImage(post.contentHtml ?? "", post.featuredImage);
  const { intro: introHtml, rest: restHtml } = splitIntroSection(bodyHtml);

  const SITE_URL = "https://www.tertiaryinfotech.com";
  const postUrl = `${SITE_URL}/blog/${post.slug}`;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: (post.updatedAt ?? post.publishedAt)?.toISOString(),
    image: post.featuredImage ? new URL(post.featuredImage, SITE_URL).toString() : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    author: {
      "@type": "Organization",
      name: "Tertiary Infotech Academy",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Tertiary Infotech Academy",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.ico` },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  };

  return (
    <>
      <Navbar />
      <main>
        <article className="pt-2 pb-6">
          <Container className="max-w-4xl">
            <div className="grid md:grid-cols-2 gap-8 items-start mb-6">
              {post.featuredImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full rounded-xl border border-white/10"
                />
              )}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/55 text-xs font-mono mb-3">
                  <span className="inline-flex items-center gap-1.5">
                    <KidsIcon name="home" className="w-3.5 h-3.5 text-(--color-cyan)/80" />
                    Author: Tertiary Infotech Academy
                  </span>
                  {post.publishedAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <KidsIcon name="sun" className="w-3.5 h-3.5 text-(--color-cyan)/80" />
                      Created On: {formatDateDMY(post.publishedAt)}
                    </span>
                  )}
                </div>
                {(category || tagRows.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {category && (
                      <Link
                        href={`/blog?category=${category.slug}`}
                        className="kids-text-filter inline-flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <KidsIcon name="book" className="w-3 h-3" />
                        {category.name}
                      </Link>
                    )}
                    {tagRows.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/blog?tag=${t.slug}`}
                        className="kids-text-filter inline-flex items-center gap-1"
                      >
                        <KidsIcon name="gift" className="w-3 h-3" />
                        {t.name}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <ShareButtons url={postUrl} title={post.title} />
                  <LikeButton slug={post.slug} initialCount={post.likeCount ?? 0} />
                </div>
                {post.excerpt && (
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="kicker mb-1.5 text-cyan">Summary</p>
                    <p className="text-white/70 text-sm italic leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                )}
                {introHtml && (
                  <div
                    className="prose-dark"
                    dangerouslySetInnerHTML={{ __html: introHtml }}
                  />
                )}
              </div>
            </div>
            <div
              className="prose-dark"
              dangerouslySetInnerHTML={{ __html: restHtml }}
            />
          </Container>
        </article>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}
