import { query } from "@anthropic-ai/claude-agent-sdk";
import { getCredential } from "@/lib/secrets";
import { buildClaudeEnv, SDK_ISOLATION } from "@/lib/anthropic-auth";

const SYSTEM_PROMPTS: Record<string, string> = {
  generate_full_post: `You are a senior content writer and SEO specialist for Tertiary Infotech Academy, a Singapore B2B training-tech company. Audience: training providers, L&D managers, and tech leaders in Singapore.

Given a TOPIC, produce a complete, ready-to-publish blog post.

Return ONLY valid JSON matching this exact shape (no markdown fences, no prose before or after):
{
  "title": "Concise, click-worthy title under 70 chars",
  "slug": "kebab-case-slug-derived-from-title",
  "excerpt": "1-2 sentence summary for blog cards, under 200 chars",
  "contentHtml": "Full body as semantic HTML — <h2>, <h3>, <p>, <ul>, <ol>, <strong>. 600–1200 words. Do NOT include <h1> (the title field is the H1).",
  "seoTitle": "Under 60 chars, primary keyword near the start",
  "seoDescription": "Under 155 chars, compelling, includes primary keyword",
  "seoKeywords": "comma, separated, keywords, max 8",
  "imageQuery": "A 3-6 word phrase for stock-image search that matches the post",
  "categorySlug": "Slug of the BEST-matching category from the EXISTING_CATEGORIES list in the user message. Only invent a new slug if none of the existing categories fit.",
  "tagSlugs": ["3-6 tags as slugs. Reuse from EXISTING_TAGS where possible; new tags should be kebab-case and concise."]
}

Rules:
- Use Singapore/British spelling (organisation, optimise, programme).
- Reference Singapore context (SSG, WSQ, IMDA, MOM) only when relevant — do not force it.
- Brand name in copy: "Tertiary Infotech Academy" (not "Tertiary Infotech").
- contentHtml must be valid HTML with paragraphs in <p> tags and headings as <h2>/<h3>.
- Keep paragraphs short (2-3 sentences max) for scannability.
- Open with a hook, end with a clear call to action.
- If REFERENCE_CONTENT blocks are present in the user message, they are scraped from URLs the admin pasted. Use them as primary source material — pull concrete facts, course names, funding amounts, dates, eligibility criteria, etc. straight from them. Do not just paraphrase; weave the specifics in.
- INTERNAL & EXTERNAL LINKS: when the admin's topic / prompt mentions specific URLs (course pages, partner sites, government schemes), embed them as <a href="URL" target="_blank" rel="noopener noreferrer">descriptive anchor text</a> on the most relevant keyword in the body — never as a bare URL and never as "click here". Also link the post's primary keywords (e.g. course names like "AWS Solutions Architect", schemes like "SkillsFuture", brand names like "Skillable Builder") to their canonical pages when the admin has given the URL. Aim for 3–6 links across the article; do not over-link.`,
  enhance_post: `You are a senior editor for Tertiary Infotech Academy, a Singapore B2B training-tech company.

The admin will give you:
1. The TITLE of an existing blog post.
2. The current CONTENT_HTML of that post.
3. INSTRUCTIONS describing what to change/add (e.g. "add a section on Skillable Builder", "link these URLs to the relevant keywords", "tighten the introduction").

Your job: return a revised CONTENT_HTML that applies the instructions while preserving everything else the admin did not ask to change. Do NOT rewrite the whole article from scratch.

Return ONLY valid JSON (no markdown fences, no prose):
{
  "contentHtml": "Revised HTML body — same shape as input: <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <a>. No <h1>.",
  "excerpt": "1-2 sentence summary of the revised post for blog cards, under 200 chars."
}

Rules:
- Preserve the original structure, voice, and headings unless instructions say otherwise.
- Singapore/British spelling.
- Brand name "Tertiary Infotech Academy".
- When INSTRUCTIONS list URLs, embed them as <a href="URL" target="_blank" rel="noopener noreferrer">descriptive anchor text</a> on the most relevant existing keyword in the body. Never as bare URLs, never "click here".
- Do not duplicate existing links — if a URL is already linked from a sensible anchor, leave it.
- Do not invent facts. If instructions reference something not in the existing content, weave it in naturally as new sentences in the most relevant existing section (or add one short new <h2> section if no section fits).
- ALWAYS return the "excerpt" field. It must reflect the *revised* content, not the original. Keep it 1-2 sentences, under 200 chars, suitable for a blog-card teaser. This is required even when the admin's instructions only ask for a small tweak.`,
  generate_blog_draft:
    "You are a senior content writer for Tertiary Infotech, a Singapore B2B training-tech company. Write a structured, SEO-friendly blog draft in clean Markdown with H2/H3 headings and short paragraphs. Audience: training providers and L&D managers in Singapore.",
  improve_seo:
    "You are an SEO specialist. Rewrite the supplied text to be more search-friendly: tighter, keyword-aware, scannable. Keep the original meaning. Return only the rewritten text.",
  summarize:
    "Summarise the supplied content in 2–3 short sentences suitable for a blog excerpt / meta description. Return only the summary, no preamble.",
  suggest_meta:
    "Generate an SEO meta title (under 60 chars) and a meta description (under 155 chars) for the supplied content. Return ONLY a JSON object: {\"title\": string, \"description\": string}.",
  rewrite:
    "Rewrite the supplied text in a clearer, more engaging tone while keeping the meaning. Return only the rewritten text.",
};

/**
 * Run an arbitrary system prompt against the Claude Agent SDK (OAuth
 * subscription path). Used by the weekly-blog scheduler which loads its
 * system prompts from `.claude/agents/*.md` instead of the SYSTEM_PROMPTS
 * map. Same auth and tool-disable rules as `runClaudeAssist`.
 */
export async function runClaudeWithSystemPrompt(
  systemPrompt: string,
  userContext: string,
  label = "custom",
): Promise<string> {
  const token = await getCredential("anthropic_auth_token");
  if (!token) {
    throw new Error(
      "Claude OAuth token not configured. Set it in Admin → Settings → Credentials.",
    );
  }
  return runWithPrompt(token, systemPrompt, userContext, label);
}

export async function runClaudeAssist(
  mode: keyof typeof SYSTEM_PROMPTS,
  userContext: string,
): Promise<string> {
  const token = await getCredential("anthropic_auth_token");
  if (!token) {
    throw new Error(
      "Claude OAuth token not configured. Set it in Admin → Settings → Credentials.",
    );
  }
  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) throw new Error(`Unknown AI assist mode: ${mode}`);
  return runWithPrompt(token, systemPrompt, userContext, mode);
}

async function runWithPrompt(
  token: string,
  systemPrompt: string,
  userContext: string,
  label: string,
): Promise<string> {

  // Mirror /api/chat (Nemo)'s SDK options exactly — that path works on live,
  // this one was failing with 401 because `permissionMode: "bypassPermissions"`
  // triggers a different auth path that doesn't accept the OAuth subscription
  // token. The combination below (maxTurns 1, allowedTools [], disallowedTools
  // listing every potentially-auth-requiring tool) is what the chatbot uses.
  // Log the fingerprint of the token actually being used so we can confirm
  // it matches the one Nemo uses on live (which works). Never the full token.
  const tokenFp = `${token.slice(0, 12)}…${token.slice(-4)}(len=${token.length})`;
  console.log(`[ai/assist] mode=${label} token=${tokenFp} promptLen=${userContext.length}`);

  let resultText = "";
  let errorResult: string | null = null;
  let turn = 0;
  // AI Assist drives long-form content generation and editing — quality
  // matters more than latency, so pin Opus with Sonnet as the safety net.
  // maxTurns: 4 gives the SDK headroom to absorb a tool-call-attempt cycle
  // (each attempt counts as a turn even with all tools disabled).
  for await (const msg of query({
    prompt: userContext,
    options: {
      systemPrompt,
      env: buildClaudeEnv(token),
      model: "opus",
      fallbackModel: "sonnet",
      maxTurns: 4,
      ...SDK_ISOLATION, // keeps CLAUDE.md / skills / memory out of the prompt
      allowedTools: [],
      disallowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
    },
  })) {
    if (msg.type === "assistant") {
      turn++;
      let chars = 0;
      for (const block of msg.message.content) {
        if (block.type === "text") {
          chars += block.text.length;
          if (!resultText) resultText += block.text;
        }
      }
      console.log(`[ai/assist] turn=${turn} assistant chars=${chars}`);
    }
    if (msg.type === "result") {
      const m = msg as { subtype?: string; result?: string; is_error?: boolean };
      console.log(
        `[ai/assist] result subtype=${m.subtype} is_error=${m.is_error} preview=${(m.result ?? "").slice(0, 200)}`,
      );
      if (m.subtype === "success" && m.result) {
        resultText = m.result;
      } else if (m.is_error || m.subtype === "error") {
        errorResult = m.result ?? `error subtype=${m.subtype}`;
      }
    }
  }
  if (!resultText && errorResult) {
    console.error(`[ai/assist] SDK returned error: ${errorResult}`);
    throw new Error(errorResult);
  }
  return resultText.trim();
}
