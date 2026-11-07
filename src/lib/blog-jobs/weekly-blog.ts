import fs from "node:fs/promises";
import path from "node:path";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  posts,
  tags,
  postTags,
  categories,
  blogScheduleRuns,
  settings,
} from "@/db/schema";
import { runClaudeWithSystemPrompt } from "@/lib/ai/claude";
import { renderAndUploadCover } from "@/lib/post-cover";
import { getR2Config } from "@/lib/r2";
import { HOLIDAY_WORKSHOPS } from "@/lib/holiday-workshops";
import { slugify } from "@/lib/slugify";
import {
  getRecentVideos,
  getTranscript,
  resolveChannelId,
  type YtVideo,
} from "@/lib/blog-jobs/youtube";
import { enforceLinks, ensureLinksOpenInNewTab, rewriteKnownBadLinks } from "@/lib/blog-jobs/link-enforcer";
import { htmlToTipTap } from "@/lib/tiptap-from-html";
import { pushPostToRemote } from "@/lib/blog-jobs/remote-sync";

export type Trigger = "cron" | "http" | "manual";

export type JobResult = {
  status: "ok" | "skipped" | "error";
  message: string;
  postId?: number;
  postSlug?: string;
  videoId?: string;
};

const AGENTS_DIR = path.join(process.cwd(), ".claude", "agents");

async function loadAgentPrompt(name: string): Promise<string> {
  const file = path.join(AGENTS_DIR, `${name}.md`);
  const raw = await fs.readFile(file, "utf8");
  // Strip YAML frontmatter; keep the body as the system prompt.
  return raw.replace(/^---[\s\S]*?---\s*/, "").trim();
}

async function getSetting<T = string>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) return fallback;
  const v = row.value as unknown;
  return (v === null || v === undefined ? fallback : v) as T;
}

function buildInternalLinkCatalog(): string {
  const lines = HOLIDAY_WORKSHOPS.map((w) => `- /holiday-workshops/${w.slug} — ${w.title}: ${w.summary}`);
  lines.unshift("- /games — AI games a parent unlocks for their child");
  lines.unshift("- /programs — small live AI classes for kids");
  lines.unshift("- /blog — index of all Tertiary Infotech Academy journal posts");
  lines.unshift("- /contact — lead-capture form (CTA target with ?source=blog-… tokens)");
  return lines.join("\n");
}

function parseJsonStrict<T>(raw: string, where: string): T {
  // The agent prompt forbids fences, but be tolerant of one stray fence.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `${where}: invalid JSON from agent (len=${cleaned.length}, head=${cleaned.slice(0, 120)})`,
    );
  }
}

type TopicBrief = {
  topic: string;
  anglePromise: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  kicker: string;
  icp: string;
  ctaIntent: string;
  supportingFacts: string[];
  videoCitation: { url: string; title: string; anchor: string };
  error?: string;
  reason?: string;
};

type WriterOutput = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  imageQuery: string;
  kicker: string;
  categorySlug: string;
  tagSlugs: string[];
  error?: string;
  reason?: string;
};

async function logRun(row: typeof blogScheduleRuns.$inferInsert): Promise<void> {
  await db.insert(blogScheduleRuns).values(row);
}

async function alreadyHandled(videoId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blogScheduleRuns.id })
    .from(blogScheduleRuns)
    .where(and(eq(blogScheduleRuns.videoId, videoId), eq(blogScheduleRuns.status, "ok")))
    .limit(1);
  return !!row;
}

async function resolveCategoryId(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function upsertTags(slugs: string[]): Promise<number[]> {
  const out: number[] = [];
  for (const raw of slugs) {
    const s = slugify(raw);
    if (!s) continue;
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.slug, s))
      .limit(1);
    if (existing) {
      out.push(existing.id);
      continue;
    }
    const [inserted] = await db
      .insert(tags)
      .values({ slug: s, name: raw })
      .returning({ id: tags.id });
    out.push(inserted.id);
  }
  return out;
}

async function ensureUniqueSlug(slug: string): Promise<string> {
  let candidate = slug;
  let n = 2;
  while (true) {
    const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, candidate)).limit(1);
    if (!row) return candidate;
    candidate = `${slug}-${n++}`;
    if (n > 50) throw new Error("Cannot find unique slug");
  }
}

export async function runWeeklyBlogJob(opts: { trigger: Trigger }): Promise<JobResult> {
  const start = Date.now();
  const trigger = opts.trigger;

  let video: YtVideo | null = null;
  let videoIdLogged: string | undefined;

  try {
    const handle = await getSetting<string>("blog_schedule_yt_channel", "@lev-selector");
    // Auto-approve is ON by default — admin can toggle it off to require a
    // manual review of the draft before it appears on /blog.
    const autoApprove = await getSetting<boolean | string>("blog_schedule_auto_approve", true);
    const isAuto = autoApprove === true || autoApprove === "true";
    const defaultStatus: "draft" | "published" = isAuto ? "published" : "draft";
    const authorId = Number(await getSetting<string>("blog_schedule_author_id", "2")) || 2;
    const categorySlug = await getSetting<string>(
      "blog_schedule_category_slug",
      "ai-automation",
    );

    let channelId = await getSetting<string>("blog_schedule_yt_channel_id", "");
    if (!channelId) {
      channelId = await resolveChannelId(handle);
      await db
        .insert(settings)
        .values({ key: "blog_schedule_yt_channel_id", value: channelId as unknown as object })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: channelId as unknown as object, updatedAt: new Date() },
        });
    }

    // Walk the RSS feed newest → oldest, pick the first video we haven't
    // already turned into a post. Prevents repeating the same topic when no
    // new video has dropped since the last run.
    const recent = await getRecentVideos(channelId, 15);
    if (recent.length === 0) throw new Error("RSS feed has no entries");
    for (const candidate of recent) {
      if (!(await alreadyHandled(candidate.videoId))) {
        video = candidate;
        break;
      }
    }
    if (!video) {
      const newest = recent[0];
      const msg = `All ${recent.length} recent videos already covered (newest: ${newest.videoId})`;
      await logRun({
        trigger,
        status: "skipped",
        videoId: newest.videoId,
        videoTitle: newest.title,
        videoUrl: newest.url,
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      return { status: "skipped", message: msg, videoId: newest.videoId };
    }
    videoIdLogged = video.videoId;

    const transcript = await getTranscript(video.videoId);

    // Stage 1 — topic picker
    const topicPrompt = await loadAgentPrompt("lev-selector-topic-picker");
    const topicInput = [
      `VIDEO_TITLE: ${video.title}`,
      `VIDEO_URL: ${video.url}`,
      `PUBLISHED_AT: ${video.publishedAt ?? ""}`,
      `TRANSCRIPT:`,
      transcript ? transcript.slice(0, 16000) : "(transcript unavailable)",
    ].join("\n");
    const topicRaw = await runClaudeWithSystemPrompt(topicPrompt, topicInput, "auto-blog/topic");
    const brief = parseJsonStrict<TopicBrief>(topicRaw, "topic-picker");
    if (brief.error) {
      const msg = `topic-picker refused: ${brief.reason ?? brief.error}`;
      await logRun({
        trigger,
        status: "skipped",
        videoId: video.videoId,
        videoTitle: video.title,
        videoUrl: video.url,
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      return { status: "skipped", message: msg, videoId: video.videoId };
    }

    // Stage 2 — writer
    const writerPrompt = await loadAgentPrompt("auto-blog-writer");
    const writerInput = [
      `TOPIC_BRIEF:\n${JSON.stringify(brief, null, 2)}`,
      ``,
      `INTERNAL_LINK_CATALOG:\n${buildInternalLinkCatalog()}`,
      ``,
      `SOURCE_VIDEO:\n${video.title} — ${video.url}`,
    ].join("\n");
    const writerRaw = await runClaudeWithSystemPrompt(writerPrompt, writerInput, "auto-blog/write");
    const draft = parseJsonStrict<WriterOutput>(writerRaw, "auto-blog-writer");
    if (draft.error) {
      const msg = `writer refused: ${draft.reason ?? draft.error}`;
      await logRun({
        trigger,
        status: "skipped",
        videoId: video.videoId,
        videoTitle: video.title,
        videoUrl: video.url,
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      return { status: "skipped", message: msg, videoId: video.videoId };
    }

    // Enforce link quotas
    const slugToken = slugify(draft.slug).slice(0, 32) || "post";
    const rewritten = rewriteKnownBadLinks(draft.contentHtml);
    const enforced = enforceLinks(rewritten, slugToken);
    const contentHtml = ensureLinksOpenInNewTab(enforced.html);

    // Cover image
    const r2 = await getR2Config();
    let featuredImage: string | null = null;
    if (r2) {
      try {
        const cover = await renderAndUploadCover(
          r2,
          draft.imageQuery || draft.title,
          draft.slug,
          draft.kicker || brief.kicker,
        );
        featuredImage = cover.url;
      } catch (err) {
        console.warn("[auto-blog] cover render failed:", err);
      }
    } else {
      console.warn("[auto-blog] R2 not configured — post will publish without cover");
    }

    // Insert post
    const uniqueSlug = await ensureUniqueSlug(slugify(draft.slug));
    const categoryId = await resolveCategoryId(categorySlug);
    const now = new Date();
    const [inserted] = await db
      .insert(posts)
      .values({
        slug: uniqueSlug,
        title: draft.title,
        excerpt: draft.excerpt,
        content: htmlToTipTap(contentHtml) as unknown as object,
        contentHtml,
        status: defaultStatus,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        seoKeywords: draft.seoKeywords,
        canonicalUrl: `https://www.tertiaryinfotech.com/blog/${uniqueSlug}`,
        authorId,
        featuredImage,
        categoryId,
        publishedAt: defaultStatus === "published" ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: posts.id, slug: posts.slug });

    const tagIds = await upsertTags(draft.tagSlugs ?? []);
    for (const tagId of tagIds) {
      await db
        .insert(postTags)
        .values({ postId: inserted.id, tagId })
        .onConflictDoNothing();
    }

    // Mirror to production if configured. When the job runs ON production,
    // REMOTE_SYNC_URL is unset and this is a no-op. When the admin fires
    // "Run now" locally, this lands the same post on www.tertiaryinfotech.com.
    const pushOn = await getSetting<boolean | string>("blog_schedule_push_to_remote", true);
    let remoteMsg = "";
    if (pushOn === true || pushOn === "true") {
      const remote = await pushPostToRemote(inserted.id);
      if (remote.status === "ok") remoteMsg = ` | remote: ok (${remote.httpStatus})`;
      else if (remote.status === "skipped") remoteMsg = ` | remote: skipped (${remote.reason})`;
      else remoteMsg = ` | remote: ERROR ${remote.message}`;
      console.log(`[auto-blog] remote sync: ${remote.status}`, remote);
    } else {
      remoteMsg = " | remote: disabled";
    }

    await logRun({
      trigger,
      status: "ok",
      videoId: video.videoId,
      videoTitle: video.title,
      videoUrl: video.url,
      postId: inserted.id,
      postSlug: inserted.slug,
      durationMs: Date.now() - start,
      errorMessage: remoteMsg.startsWith(" | remote: ERROR") ? remoteMsg.trim() : null,
    });

    return {
      status: "ok",
      message: `Created post ${inserted.id} (${inserted.slug}) from video ${video.videoId}${remoteMsg}`,
      postId: inserted.id,
      postSlug: inserted.slug,
      videoId: video.videoId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auto-blog] error:", err);
    await logRun({
      trigger,
      status: "error",
      videoId: videoIdLogged,
      videoTitle: video?.title,
      videoUrl: video?.url,
      durationMs: Date.now() - start,
      errorMessage: message.slice(0, 2000),
    });
    return { status: "error", message, videoId: videoIdLogged };
  }
}

export async function listRecentRuns(limit = 20) {
  return db
    .select()
    .from(blogScheduleRuns)
    .orderBy(desc(blogScheduleRuns.runAt))
    .limit(limit);
}
