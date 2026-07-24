import { db } from "@/db";
import { socialPosts, posts, postTags, tags } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { SocialPostsTable, type SocialPostRow } from "@/components/admin/SocialPostsTable";
import { dispatchDueSocialPosts } from "@/lib/social/dispatch";
import { getSocialAutoPublish, setSocialAutoPublish } from "@/lib/social/settings";
import { AutoPublishToggle } from "@/components/admin/AutoPublishToggle";
import { htmlToPlainText } from "@/lib/social/html-to-social";
import { requireStaff } from "@/lib/admin-guard";
import {
  generateLinkedInPostLLM,
  generateFacebookPostLLM,
} from "@/lib/social/llm-generator";

export const dynamic = "force-dynamic";

export default async function SocialPostsList() {
  const autoPublish = await getSocialAutoPublish();

  async function toggleAutoPublish(enabled: boolean) {
    "use server";
    await requireStaff();
    await setSocialAutoPublish(enabled);
    revalidatePath("/admin/social");
  }

  const rows = await db
    .select({
      id: socialPosts.id,
      postId: socialPosts.postId,
      postSlug: posts.slug,
      postTitle: posts.title,
      platform: socialPosts.platform,
      status: socialPosts.status,
      content: socialPosts.content,
      imageUrl: socialPosts.imageUrl,
      linkUrl: socialPosts.linkUrl,
      scheduledAt: socialPosts.scheduledAt,
      publishedAt: socialPosts.publishedAt,
      externalUrl: socialPosts.externalUrl,
      errorMessage: socialPosts.errorMessage,
      attemptCount: socialPosts.attemptCount,
      createdAt: socialPosts.createdAt,
    })
    .from(socialPosts)
    .leftJoin(posts, eq(posts.id, socialPosts.postId))
    .orderBy(desc(socialPosts.createdAt));

  async function deleteMany(ids: number[]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return;
    await db.delete(socialPosts).where(inArray(socialPosts.id, ids));
    revalidatePath("/admin/social");
  }

  async function updateRow(input: {
    id: number;
    content?: string;
    scheduledAt?: string | null;
    status?: SocialPostRow["status"];
  }) {
    "use server";
    await requireStaff();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof input.content === "string") patch.content = input.content;
    if (input.scheduledAt !== undefined) {
      patch.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    if (input.status) patch.status = input.status;
    await db.update(socialPosts).set(patch).where(eq(socialPosts.id, input.id));
    revalidatePath("/admin/social");
  }

  async function regenerate(id: number) {
    "use server";
    await requireStaff();
    const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
    if (!row || !row.postId) return;
    const [post] = await db.select().from(posts).where(eq(posts.id, row.postId));
    if (!post) return;
    const tagRows = await db
      .select({ slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(eq(postTags.postId, post.id));
    const url =
      (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tertiaryinfotech.com") +
      `/blog/${post.slug}`;
    const input = {
      title: post.title.trim(),
      excerpt: (post.excerpt ?? "").trim(),
      bodyPlainText: post.contentHtml ? htmlToPlainText(post.contentHtml) : "",
      url,
      tagSlugs: tagRows.map((t) => t.slug),
    };
    const fresh =
      row.platform === "linkedin"
        ? await generateLinkedInPostLLM(input)
        : await generateFacebookPostLLM(input);
    if (!fresh) return;
    await db
      .update(socialPosts)
      .set({ content: fresh, updatedAt: new Date() })
      .where(eq(socialPosts.id, id));
    revalidatePath("/admin/social");
  }

  async function dispatchNow(ids: number[]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return { picked: 0, published: 0, failed: 0, details: [] };
    const r = await dispatchDueSocialPosts({ ids });
    revalidatePath("/admin/social");
    return r;
  }

  /**
   * Re-roll the copy with a fresh LLM call, reset the row so the dispatcher
   * treats it as new, then publish a brand-new social post. Used to replace
   * an earlier published post that was generated with the old (thin) copy.
   * The user is responsible for deleting the previous post on the platform —
   * platforms don't expose an "overwrite" call.
   */
  async function regenerateAndRepost(id: number) {
    "use server";
    await requireStaff();
    await regenerate(id);
    await db
      .update(socialPosts)
      .set({
        status: "draft",
        externalId: null,
        externalUrl: null,
        publishedAt: null,
        errorMessage: null,
        attemptCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, id));
    const r = await dispatchDueSocialPosts({ ids: [id] });
    revalidatePath("/admin/social");
    return r;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Social</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <a
            href="/admin/social/log"
            className="text-sm text-(--color-cyan) hover:underline"
          >
            Activity log →
          </a>
          <a
            href="/admin/settings/credentials"
            className="text-sm text-(--color-cyan) hover:underline"
          >
            Configure LinkedIn + Facebook credentials →
          </a>
          <span className="text-sm text-white/50 font-mono">[ {rows.length} total ]</span>
        </div>
      </div>
      <p className="text-sm text-(--color-muted) mb-4">
        When a blog post is published, a draft is queued here per platform.
        Edit the copy, pick a schedule time, and the cron dispatcher will
        publish it. <span className="font-mono text-xs">[ POST /api/cron/social-dispatch ]</span>{" "}
        runs every 5 minutes from Coolify cron.
      </p>
      <AutoPublishToggle enabled={autoPublish} onToggle={toggleAutoPublish} />
      <SocialPostsTable
        rows={rows.map((r) => ({
          id: r.id,
          postId: r.postId,
          postSlug: r.postSlug,
          postTitle: r.postTitle,
          platform: r.platform,
          status: r.status,
          content: r.content,
          imageUrl: r.imageUrl,
          linkUrl: r.linkUrl,
          scheduledAt: r.scheduledAt?.toISOString() ?? null,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          externalUrl: r.externalUrl,
          errorMessage: r.errorMessage,
          attemptCount: r.attemptCount,
          createdAt: r.createdAt.toISOString(),
        }))}
        deleteMany={deleteMany}
        updateRow={updateRow}
        dispatchNow={dispatchNow}
        regenerate={regenerate}
        regenerateAndRepost={regenerateAndRepost}
      />
    </div>
  );
}
