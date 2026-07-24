import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts, categories, tags, postTags } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { PostEditorForm, type PostFormData } from "@/components/admin/PostEditorForm";
import type { JSONContent } from "@tiptap/react";
import { getAdminSession } from "@/lib/admin-role";
import { createDraftSocialPosts } from "@/lib/social/draft";
import { dispatchDueSocialPosts } from "@/lib/social/dispatch";
import { getSocialAutoPublish } from "@/lib/social/settings";
import { requireStaff } from "@/lib/admin-guard";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Resolve a category by slug — return its id, creating the row if it doesn't exist. */
async function resolveCategoryId(slug: string): Promise<number> {
  const clean = slugify(slug);
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, clean))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(categories)
    .values({ slug: clean, name: titleCase(clean) })
    .returning();
  return created.id;
}

/** Resolve tag slugs — create any that don't exist, return ordered list of ids. */
async function resolveTagIds(slugs: string[]): Promise<number[]> {
  const cleaned = Array.from(new Set(slugs.map(slugify).filter(Boolean)));
  if (cleaned.length === 0) return [];
  const existing = await db
    .select()
    .from(tags)
    .where(inArray(tags.slug, cleaned));
  const existingBySlug = new Map(existing.map((t) => [t.slug, t.id]));
  const missing = cleaned.filter((s) => !existingBySlug.has(s));
  if (missing.length > 0) {
    const created = await db
      .insert(tags)
      .values(missing.map((s) => ({ slug: s, name: titleCase(s) })))
      .returning();
    for (const t of created) existingBySlug.set(t.slug, t.id);
  }
  return cleaned.map((s) => existingBySlug.get(s)!).filter(Boolean);
}

export default async function EditPost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();
  const [p] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!p) notFound();

  // Authors can only edit their own posts.
  const session = await getAdminSession();
  if (session?.role === "author") {
    const authorId = Number(session.id);
    if (Number.isFinite(authorId) && p.authorId !== authorId) {
      redirect("/admin/posts");
    }
  }

  // WordPress-imported posts have a placeholder TipTap doc and the real body
  // in contentHtml. Detect that case and feed the HTML string to the editor
  // (Editor.tsx will parse it back into JSON on first render).
  const isWpPlaceholder =
    JSON.stringify(p.content).includes("(Imported from WordPress)");
  const editorContent: JSONContent | string =
    isWpPlaceholder && p.contentHtml
      ? p.contentHtml
      : (p.content as JSONContent);

  // Load current category + tag slugs so the editor can display + edit them.
  const [currentCat] = p.categoryId
    ? await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1)
    : [null];
  const currentTagRows = await db
    .select({ slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, p.id));

  const initial: PostFormData = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? "",
    content: editorContent,
    contentHtml: p.contentHtml ?? "",
    status: p.status,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    seoKeywords: p.seoKeywords ?? "",
    ogImage: p.ogImage ?? "",
    featuredImage: p.featuredImage ?? "",
    suggestedCategorySlug: currentCat?.slug ?? "",
    suggestedTagSlugs: currentTagRows.map((t) => t.slug),
  };

  async function save(data: PostFormData) {
    "use server";
    await requireStaff();
    const categoryId = data.suggestedCategorySlug
      ? await resolveCategoryId(data.suggestedCategorySlug)
      : undefined;

    await db
      .update(posts)
      .set({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content,
        contentHtml: data.contentHtml,
        status: data.status,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        seoKeywords: data.seoKeywords || null,
        ogImage: data.ogImage || null,
        featuredImage: data.featuredImage || null,
        ...(categoryId ? { categoryId } : {}),
        publishedAt:
          data.status === "published" && !p.publishedAt ? new Date() : p.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, data.id));

    // Replace tag links to match the user's input (treats the field as
    // authoritative). Clearing the field removes all tags.
    if (Array.isArray(data.suggestedTagSlugs)) {
      await db.delete(postTags).where(eq(postTags.postId, data.id));
      const tagIds = await resolveTagIds(data.suggestedTagSlugs);
      if (tagIds.length > 0) {
        await db
          .insert(postTags)
          .values(tagIds.map((tagId) => ({ postId: data.id, tagId })))
          .onConflictDoNothing();
      }
    }

    // Auto-queue social drafts when transitioning to published.
    // Safe by design — createDraftSocialPosts is a no-op if drafts already
    // exist for this post, so re-saving a published post doesn't duplicate.
    if (data.status === "published" && !p.publishedAt) {
      try {
        const draftIds = await createDraftSocialPosts(data.id);
        // If the operator has flipped the "Auto-publish on blog publish"
        // switch on /admin/social, fire the dispatcher immediately so LinkedIn
        // + Facebook posts go live the moment the blog does.
        const autoPublish = await getSocialAutoPublish();
        if (autoPublish && draftIds.length > 0) {
          await dispatchDueSocialPosts({ ids: draftIds });
        }
        revalidatePath("/admin/social");
      } catch (e) {
        console.error("social auto-queue failed:", e);
      }
    }

    revalidatePath(`/blog/${data.slug}`);
    revalidatePath("/blog");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
  }

  async function queueSocialDrafts() {
    "use server";
    await requireStaff();
    const ids = await createDraftSocialPosts(p.id);
    // If the operator has flipped auto-publish ON, treat the manual Queue
    // Drafts click as "go live now" — saves a second trip to /admin/social.
    if ((await getSocialAutoPublish()) && ids.length > 0) {
      await dispatchDueSocialPosts({ ids });
    }
    revalidatePath("/admin/social");
    redirect("/admin/social?queued=1");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Edit Post</h1>
        {p.status === "published" && (
          <form action={queueSocialDrafts}>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg border border-(--color-cyan)/40 text-(--color-cyan) hover:bg-(--color-cyan)/10 text-sm font-mono"
              title="Create LinkedIn + Facebook draft social posts for this blog post (idempotent — no-op if drafts already exist)"
            >
              Queue social drafts →
            </button>
          </form>
        )}
      </div>
      <PostEditorForm initial={initial} save={save} kind="post" />
    </div>
  );
}
