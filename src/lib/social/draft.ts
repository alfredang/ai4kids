/**
 * Generate the initial draft copy for a social post from a blog row.
 * No LLM — deterministic, fast, runs synchronously in the publish path so the
 * editor can decide if they want to keep, edit, or reject before scheduling.
 *
 * LinkedIn drafts are long-form (title hook + excerpt + 3–5 hashtags).
 * Facebook drafts are shorter and conversational with one hashtag at most.
 */

import { db } from "@/db";
import { posts, postTags, tags, socialPosts } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  htmlToPlainText,
  clipToParagraphs,
  extractH2Headings,
  extractFirstParagraph,
} from "@/lib/social/html-to-social";
import {
  generateLinkedInPostLLM,
  generateFacebookPostLLM,
} from "@/lib/social/llm-generator";

const SITE_BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tertiaryinfotech.com";

function toHashtag(input: string): string {
  return (
    "#" +
    input
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
  );
}

// Very small stop-word list so #The / #With / #From don't slip into the tag line.
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","for","to","with","from","in","on","at",
  "by","is","are","was","were","be","been","being","as","that","this","these",
  "those","it","its","into","over","under","via","your","you","our","we","they",
  "their","his","her","he","she","i","my","me","new","best","top","how","why",
  "what","when","where","vs","than","then","so","such","one","two","also","not",
]);

/**
 * Pull capitalised multi-word phrases and proper nouns from the title — these
 * are usually the named entities a reader would actually search for.
 */
function hashtagsFromTitle(title: string, max: number): string[] {
  const cleaned = title.replace(/[—–]/g, " ").replace(/[^A-Za-z0-9 ]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let phrase: string[] = [];
  const flush = () => {
    if (phrase.length === 0) return;
    out.push("#" + phrase.join(""));
    phrase = [];
  };
  for (const w of words) {
    const isCapitalised = /^[A-Z]/.test(w) && !STOPWORDS.has(w.toLowerCase());
    if (isCapitalised) {
      phrase.push(w);
    } else {
      flush();
    }
  }
  flush();
  // Also include any uppercase acronyms (e.g. AI, ML).
  for (const w of words) {
    if (/^[A-Z]{2,}$/.test(w) && !out.includes("#" + w)) out.push("#" + w);
  }
  return out.slice(0, max);
}

const ALWAYS_INCLUDE = ["#TertiaryInfotechAcademy", "#Singapore"];

function buildHashtags(opts: {
  title: string;
  tagSlugs: string[];
  max: number;
}): string[] {
  const fromTags = opts.tagSlugs.map(toHashtag).filter((t) => t.length > 1);
  const fromTitle = hashtagsFromTitle(opts.title, 4);
  // De-duplicate case-insensitively while preserving order: tags first, then
  // title-derived, then the always-include house tags.
  const seen = new Set<string>();
  const ordered = [...fromTags, ...fromTitle, ...ALWAYS_INCLUDE];
  const out: string[] = [];
  for (const t of ordered) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= opts.max) break;
  }
  return out;
}

function linkedinDraft(opts: {
  title: string;
  hook: string;
  sections: string[];
  url: string;
  hashtags: string[];
}): string {
  const tagLine = opts.hashtags.slice(0, 8).join(" ");
  // Trim each section to a single line for the bullet list.
  const bullets = opts.sections
    .slice(0, 6)
    .map((s) => `✅ ${s}`)
    .join("\n");
  // Hook may include a long paragraph — clip so the whole post stays under
  // LinkedIn's 3000-char limit even with bullets, URL and hashtags appended.
  const hook = clipToParagraphs(opts.hook, {
    maxChars: 600,
    maxParagraphs: 2,
  });
  return [
    `🚀 ${opts.title}`,
    "",
    hook,
    "",
    "🎯 What's inside:",
    bullets,
    "",
    `🔗 Read the full piece → ${opts.url}`,
    "",
    tagLine,
  ]
    .join("\n")
    .trim();
}

function facebookDraft(opts: {
  title: string;
  body: string;
  url: string;
  hashtags: string[];
}): string {
  // Facebook posts can be very long, but engagement drops sharply past ~500
  // chars in the visible preview. Clip body around there + 2–3 focused tags.
  const tagLine = opts.hashtags.slice(0, 3).join(" ");
  const body = clipToParagraphs(opts.body, {
    maxChars: 600,
    maxParagraphs: 3,
  });
  return [
    opts.title,
    "",
    body,
    "",
    opts.url,
    "",
    tagLine,
  ]
    .join("\n")
    .trim();
}

export async function createDraftSocialPosts(postId: number): Promise<number[]> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return [];

  // Already queued? Skip — never duplicate drafts for the same post.
  const existing = await db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(eq(socialPosts.postId, postId));
  if (existing.length > 0) return existing.map((r) => r.id);

  const tagRows = await db
    .select({ slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId));

  const url = `${SITE_BASE}/blog/${post.slug}`;
  const excerpt = (post.excerpt ?? "").trim();
  const title = post.title.trim();
  const tagSlugs = tagRows.map((t) => t.slug);
  // Plain text of the full rendered blog body — falls back to excerpt for
  // short pieces. Fed to both the LLM (for context) and the deterministic
  // formatter (as a safety net).
  const bodyPlain = post.contentHtml
    ? htmlToPlainText(post.contentHtml)
    : excerpt;
  const hashtags = buildHashtags({ title, tagSlugs, max: 8 });
  const headings = post.contentHtml
    ? extractH2Headings(post.contentHtml)
    : [];
  const hook =
    (post.contentHtml ? extractFirstParagraph(post.contentHtml) : excerpt) ||
    excerpt;

  // Try LLM first (Claude Agent SDK, OAuth subscription). If it returns null
  // — token missing, network failure, suspiciously short output — fall back
  // to the deterministic template so the publish flow never blocks.
  const llmInput = {
    title,
    excerpt,
    bodyPlainText: bodyPlain,
    url,
    tagSlugs,
  };
  const [liLLM, fbLLM] = await Promise.all([
    generateLinkedInPostLLM(llmInput),
    generateFacebookPostLLM(llmInput),
  ]);

  const liContent =
    liLLM ??
    linkedinDraft({
      title,
      hook,
      sections: headings.slice(0, 6),
      url,
      hashtags,
    });
  const fbContent =
    fbLLM ?? facebookDraft({ title, body: bodyPlain, url, hashtags });

  const now = new Date();
  const inserted = await db
    .insert(socialPosts)
    .values([
      {
        postId,
        platform: "linkedin",
        status: "draft",
        content: liContent,
        imageUrl: post.featuredImage,
        linkUrl: url,
        createdAt: now,
        updatedAt: now,
      },
      {
        postId,
        platform: "facebook",
        status: "draft",
        content: fbContent,
        imageUrl: post.featuredImage,
        linkUrl: url,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .returning({ id: socialPosts.id });
  return inserted.map((r) => r.id);
}
