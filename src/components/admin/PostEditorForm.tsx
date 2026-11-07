"use client";

import { useState, useTransition } from "react";
import { Editor } from "./Editor";
import { AIAssistButton } from "./AIAssistButton";
import type { JSONContent } from "@tiptap/react";

export type PostFormData = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: JSONContent | string;
  contentHtml: string;
  status: "draft" | "published" | "archived";
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImage: string;
  featuredImage: string;
  /** Current category slug (editable). Resolved/created server-side on save. */
  suggestedCategorySlug?: string;
  /** Current tag slugs (editable, comma-separated in UI). Resolved/created server-side on save. */
  suggestedTagSlugs?: string[];
};

type Props = {
  initial: PostFormData;
  save: (data: PostFormData) => Promise<void>;
  kind: "post" | "page";
};

function sanitizeJsonControlChars(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

export function PostEditorForm({ initial, save, kind }: Props) {
  const [data, setData] = useState<PostFormData>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [topic, setTopic] = useState("");
  const [enhanceInstructions, setEnhanceInstructions] = useState("");
  const [aiTab, setAiTab] = useState<"generate" | "enhance">("generate");

  function update<K extends keyof PostFormData>(key: K, value: PostFormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [contentMode, setContentMode] = useState<"editor" | "html">("editor");

  async function fetchAndApplyImage(query: string, slug: string, kicker?: string) {
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch("/api/ai/post-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, slug, kicker }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || `Image fetch failed (${res.status})`);
      }
      setData((d) => ({ ...d, featuredImage: data.url! }));
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Image fetch failed");
    } finally {
      setImageLoading(false);
    }
  }

  function applyAiPost(raw: string) {
    // Claude returns JSON; tolerate fences and stray prose around the object.
    let json = raw.trim();
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }
    // If the model added prose before/after the JSON, extract the outermost {...}.
    if (!json.startsWith("{")) {
      const first = json.indexOf("{");
      const last = json.lastIndexOf("}");
      if (first !== -1 && last > first) json = json.slice(first, last + 1);
    }
    // The model frequently emits raw newlines/tabs inside the contentHtml
    // string value, which is invalid JSON (string literals must escape them).
    // Walk the text and escape control chars that appear inside string scopes.
    json = sanitizeJsonControlChars(json);
    let obj: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      contentHtml: string;
      seoTitle: string;
      seoDescription: string;
      seoKeywords: string;
      imageQuery: string;
      categorySlug: string;
      tagSlugs: string[];
    }> = {};
    try {
      obj = JSON.parse(json);
    } catch {
      // Parse failed — dump the raw response into the editor so nothing is lost.
      setData((d) => ({ ...d, contentHtml: raw, content: raw }));
      return;
    }
    setData((d) => ({
      ...d,
      title: obj.title || d.title,
      slug: obj.slug || d.slug,
      excerpt: obj.excerpt || d.excerpt,
      contentHtml: obj.contentHtml || d.contentHtml,
      // Tiptap's setContent accepts an HTML string directly and parses it
      // into a proper document. Storing the HTML here means the editor
      // renders the AI draft instead of showing raw markup as text.
      content: obj.contentHtml || d.content,
      seoTitle: obj.seoTitle || d.seoTitle,
      seoDescription: obj.seoDescription || d.seoDescription,
      seoKeywords: obj.seoKeywords || d.seoKeywords,
      suggestedCategorySlug: obj.categorySlug || d.suggestedCategorySlug,
      suggestedTagSlugs: Array.isArray(obj.tagSlugs) ? obj.tagSlugs : d.suggestedTagSlugs,
    }));

    // Kick off image generation in parallel — non-blocking. Render the
    // post title onto a branded SVG card; categorySlug becomes the kicker.
    if (kind === "post" && obj.title) {
      void fetchAndApplyImage(
        obj.title,
        obj.slug || data.slug,
        obj.categorySlug?.replace(/-/g, " "),
      );
    }
  }

  function applyEnhancedPost(raw: string) {
    // enhance_post returns { contentHtml }. Be tolerant of fences/prose.
    let json = raw.trim();
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }
    if (!json.startsWith("{")) {
      const first = json.indexOf("{");
      const last = json.lastIndexOf("}");
      if (first !== -1 && last > first) json = json.slice(first, last + 1);
    }
    json = sanitizeJsonControlChars(json);
    let obj: Partial<{ contentHtml: string; excerpt: string }> = {};
    try {
      obj = JSON.parse(json);
    } catch {
      // No structured response — treat the raw text as the new body.
      setData((d) => ({ ...d, contentHtml: raw, content: raw }));
      return;
    }
    if (obj.contentHtml) {
      setData((d) => ({
        ...d,
        contentHtml: obj.contentHtml!,
        content: obj.contentHtml!,
        excerpt: obj.excerpt || d.excerpt,
      }));
    }
  }

  function submit() {
    startTransition(async () => {
      await save(data);
      setSavedAt(new Date());
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {kind === "post" && (
          <div className="glass rounded-xl p-4 space-y-3 border border-(--color-purple)/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAiTab("generate")}
                  className={`px-3 py-1.5 rounded uppercase tracking-wider ${
                    aiTab === "generate"
                      ? "bg-(--color-purple)/30 text-(--color-purple)"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Generate full post
                </button>
                <button
                  type="button"
                  onClick={() => setAiTab("enhance")}
                  className={`px-3 py-1.5 rounded uppercase tracking-wider ${
                    aiTab === "enhance"
                      ? "bg-(--color-cyan)/30 text-(--color-cyan)"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Enhance existing
                </button>
              </div>
              {aiTab === "generate" ? (
                <AIAssistButton
                  mode="generate_full_post"
                  context={`TOPIC: ${topic || data.title || "(no topic)"}`}
                  onResult={applyAiPost}
                  label="Generate full post"
                />
              ) : (
                <AIAssistButton
                  mode="enhance_post"
                  context={`TITLE: ${data.title}\n\nCURRENT_CONTENT_HTML:\n${data.contentHtml}\n\nINSTRUCTIONS:\n${enhanceInstructions || "(no instructions)"}`}
                  onResult={applyEnhancedPost}
                  label="Enhance post"
                />
              )}
            </div>
            {aiTab === "generate" ? (
              <>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  placeholder="Enter a topic. e.g. 'Fun ways to explore AI with your child this December' — Claude will draft the title, slug, content, excerpt, and all SEO fields."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
                />
                <p className="text-[11px] text-white/40">
                  Replaces every field (title, slug, content, excerpt, SEO, category, tags). Review then click Save.
                </p>
              </>
            ) : (
              <>
                <textarea
                  value={enhanceInstructions}
                  onChange={(e) => setEnhanceInstructions(e.target.value)}
                  rows={3}
                  placeholder="What should change? e.g. 'Add a section about Skillable Builder. Link AWS Training to https://www.tertiarycourses.com.sg/aws-cloud-computing-courses.html and Skillable Builder to https://skillbuilder.aws/.'"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
                />
                <p className="text-[11px] text-white/40">
                  Edits the existing body only — preserves title, slug, SEO, category, and tags. Use this to add facts, insert links, or tweak sections without rewriting from scratch.
                </p>
              </>
            )}
          </div>
        )}
        <div>
          <label className="text-xs uppercase text-white/50">Title</label>
          <div className="flex gap-2 items-start">
            <input
              value={data.title}
              onChange={(e) => update("title", e.target.value)}
              className="flex-1 px-3 py-2 text-2xl font-bold bg-white/5 border border-white/10 rounded focus:outline-none focus:border-neon-blue"
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase text-white/50">Slug</label>
          <input
            value={data.slug}
            onChange={(e) => update("slug", e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-neon-blue font-mono text-sm"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1 gap-2">
            <label className="text-xs uppercase text-white/50">Content</label>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded border border-white/10 bg-white/5 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setContentMode("editor")}
                  className={`px-2 py-1 rounded ${
                    contentMode === "editor"
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode("html")}
                  className={`px-2 py-1 rounded font-mono ${
                    contentMode === "html"
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  HTML
                </button>
              </div>
              <AIAssistButton
                mode="generate_blog_draft"
                context={`Topic: ${data.title || "(no title)"}\nCurrent excerpt: ${data.excerpt}`}
                onResult={(text) => {
                  setData((d) => ({ ...d, contentHtml: text, content: text }));
                }}
                label="Draft"
              />
            </div>
          </div>
          {contentMode === "editor" ? (
            <Editor
              value={data.content}
              onChange={(json, html) => {
                update("content", json);
                update("contentHtml", html);
              }}
            />
          ) : (
            <textarea
              value={data.contentHtml}
              onChange={(e) => {
                // Keep `content` in sync as the HTML string so when the user
                // toggles back to Editor, Tiptap re-parses it into a doc.
                setData((d) => ({ ...d, contentHtml: e.target.value, content: e.target.value }));
              }}
              rows={20}
              spellCheck={false}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-neon-blue font-mono text-xs leading-relaxed"
            />
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs uppercase text-white/50">Excerpt</label>
            <AIAssistButton
              mode="summarize"
              context={data.contentHtml || data.title}
              onResult={(text) => update("excerpt", text)}
              label="Summarize"
            />
          </div>
          <textarea
            value={data.excerpt}
            onChange={(e) => update("excerpt", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-neon-blue"
          />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="font-bold">Publish</h3>
          <label className="block">
            <span className="text-xs text-white/60">Status</span>
            <select
              value={data.status}
              onChange={(e) =>
                update("status", e.target.value as PostFormData["status"])
              }
              className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button
            onClick={submit}
            disabled={pending}
            className="w-full py-2 rounded bg-gradient-to-r from-neon-blue to-neon-cyan font-semibold disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {savedAt && (
            <p className="text-xs text-neon-cyan">Saved {savedAt.toLocaleTimeString()}</p>
          )}
        </div>

        {kind === "post" && (
          <div className="glass rounded-xl p-4 space-y-3 border border-(--color-purple)/30">
            <h3 className="font-bold text-sm">Category & Tags</h3>
            <div>
              <label className="kicker block mb-1" htmlFor="post-category-slug">
                Category (slug)
              </label>
              <input
                id="post-category-slug"
                value={data.suggestedCategorySlug ?? ""}
                onChange={(e) => update("suggestedCategorySlug", e.target.value)}
                placeholder="ai-services"
                className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm font-mono"
              />
            </div>
            <div>
              <label className="kicker block mb-1" htmlFor="post-tag-slugs">
                Tags (comma-separated slugs)
              </label>
              <input
                id="post-tag-slugs"
                value={(data.suggestedTagSlugs ?? []).join(", ")}
                onChange={(e) =>
                  update(
                    "suggestedTagSlugs",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="parents, ai-for-kids, december-workshops"
                className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm font-mono"
              />
            </div>
            <p className="text-[11px] text-white/40">
              Existing slugs are reused; unknown slugs will be created on save. Clear a field to remove all values.
            </p>
          </div>
        )}
        {kind === "post" && (
          <div className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">Featured image</h3>
              <button
                type="button"
                disabled={imageLoading || !data.title}
                onClick={() =>
                  fetchAndApplyImage(
                    data.title,
                    data.slug,
                    data.suggestedCategorySlug?.replace(/-/g, " "),
                  )
                }
                className="px-3 py-1.5 text-xs rounded bg-gradient-to-r from-(--color-purple) to-(--color-cyan) hover:opacity-90 disabled:opacity-40 font-medium"
                title={data.title ? "Generate a branded SVG cover image from the current title" : "Add a title first"}
              >
                {imageLoading ? "✨ Generating…" : "✨ AI Regenerate Image"}
              </button>
            </div>
            <input
              value={data.featuredImage}
              onChange={(e) => update("featuredImage", e.target.value)}
              placeholder="/blog/hero.jpg or absolute URL"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
            />
            {imageError && <p className="text-xs text-red-400">{imageError}</p>}
            {data.featuredImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.featuredImage} alt="" className="rounded mt-2" />
            )}
          </div>
        )}

        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">SEO</h3>
            <AIAssistButton
              mode="suggest_meta"
              context={`Title: ${data.title}\n\n${data.contentHtml.slice(0, 4000)}`}
              onResult={(text) => {
                try {
                  const obj = JSON.parse(text) as { title?: string; description?: string };
                  if (obj.title) update("seoTitle", obj.title);
                  if (obj.description) update("seoDescription", obj.description);
                } catch {
                  update("seoDescription", text);
                }
              }}
              label="Suggest"
            />
          </div>
          <Field
            label="SEO title"
            value={data.seoTitle}
            onChange={(v) => update("seoTitle", v)}
          />
          <Field
            label="Meta description"
            value={data.seoDescription}
            onChange={(v) => update("seoDescription", v)}
            multi
          />
          <Field
            label="Keywords"
            value={data.seoKeywords}
            onChange={(v) => update("seoKeywords", v)}
          />
          <Field
            label="OG image URL"
            value={data.ogImage}
            onChange={(v) => update("ogImage", v)}
          />
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multi,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-white/60">{label}</span>
      {multi ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
        />
      )}
    </label>
  );
}
