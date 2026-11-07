import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { posts, users, categories, tags, postTags } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const postSchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  excerpt: z.string().max(5000).optional().nullable(),
  content: z.unknown(),
  contentHtml: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  seoTitle: z.string().max(500).optional().nullable(),
  seoDescription: z.string().max(5000).optional().nullable(),
  seoKeywords: z.string().max(5000).optional().nullable(),
  ogImage: z.string().max(2000).optional().nullable(),
  canonicalUrl: z.string().max(2000).optional().nullable(),
  noIndex: z.boolean().optional().default(false),
  featuredImage: z.string().max(2000).optional().nullable(),
  readingTime: z.number().int().min(0).max(9999).optional().nullable(),
  featured: z.boolean().optional().default(false),
  authorEmail: z.string().email().optional().nullable(),
  categorySlug: z.string().max(255).optional().nullable(),
  tagSlugs: z.array(z.string().max(255)).optional().default([]),
  likeCount: z.number().int().min(0).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  // Preserve original authoring timestamp across sync so the admin list
  // sort ("Newest first") matches local. Without this, remote createdAt
  // tracks the first-sync time, not the post's real creation time.
  createdAt: z.string().datetime().optional().nullable(),
});

const payloadSchema = z.object({
  posts: z.array(postSchema).min(1).max(200),
});

async function resolveAuthorId(email: string | null | undefined) {
  if (!email) return null;
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

async function resolveCategoryId(slug: string | null | undefined) {
  if (!slug) return null;
  const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return c?.id ?? null;
}

async function resolveTagIds(slugs: string[]) {
  if (slugs.length === 0) return [] as number[];
  const found = await db.select().from(tags);
  const map = new Map(found.map((t) => [t.slug, t.id]));
  return slugs.map((s) => map.get(s)).filter((x): x is number => typeof x === "number");
}

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let upserted = 0;
  for (const p of parsed.data.posts) {
    const [authorId, categoryId, tagIds] = await Promise.all([
      resolveAuthorId(p.authorEmail),
      resolveCategoryId(p.categorySlug),
      resolveTagIds(p.tagSlugs ?? []),
    ]);
    // Snapshot previous state so we can detect a draft→published transition
    // (and avoid re-firing for posts that were already published).
    const row = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? null,
      content: p.content as unknown as object,
      contentHtml: p.contentHtml ?? null,
      status: p.status,
      seoTitle: p.seoTitle ?? null,
      seoDescription: p.seoDescription ?? null,
      seoKeywords: p.seoKeywords ?? null,
      ogImage: p.ogImage ?? null,
      canonicalUrl: p.canonicalUrl ?? null,
      noIndex: p.noIndex ?? false,
      featuredImage: p.featuredImage ?? null,
      readingTime: p.readingTime ?? null,
      featured: p.featured ?? false,
      authorId,
      categoryId,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    };
    // NOTE: likeCount is intentionally NOT synced from local — it's a
    // user-generated counter that accumulates on production. Overwriting it
    // with the local value (typically 0) would wipe real engagement.
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    await db
      .insert(posts)
      .values(createdAt ? { ...row, createdAt } : row)
      .onConflictDoUpdate({
        target: posts.slug,
        set: createdAt ? { ...row, createdAt, updatedAt: sql`now()` } : { ...row, updatedAt: sql`now()` },
      });

    const [postRow] = await db.select().from(posts).where(eq(posts.slug, p.slug)).limit(1);
    if (postRow) {
      await db.delete(postTags).where(eq(postTags.postId, postRow.id));
      if (tagIds.length > 0) {
        await db
          .insert(postTags)
          .values(tagIds.map((tagId) => ({ postId: postRow.id, tagId })));
      }
    }
    upserted += 1;
  }

  return NextResponse.json({
    ok: true,
    upserted,
  });
}

/**
 * DELETE — admin housekeeping: remove a post by slug. Used to clean up
 * sync probe rows. Same bearer/basic auth as POST/GET. JSON body { slug }.
 */
export async function DELETE(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
  if (!row) return NextResponse.json({ ok: true, deleted: 0 });
  await db.delete(postTags).where(eq(postTags.postId, row.id));
  await db.delete(posts).where(eq(posts.id, row.id));
  return NextResponse.json({ ok: true, deleted: 1, slug });
}

/**
 * GET — debug introspection for sync verification. Returns the top 10 posts
 * by createdAt desc with slug + createdAt + updatedAt. Same bearer/basic auth
 * as POST. Used by the local "Run sync now" UI and CI to confirm a sync took.
 *
 * Version marker `apiVersion` bumps when the createdAt round-trip lands.
 */
export async function GET(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select({
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(10);
  return NextResponse.json({
    ok: true,
    apiVersion: "createdat-roundtrip-1",
    top10: rows,
  });
}
