/**
 * Kid-safe image generation for the AI Art Studio (/learn/art).
 *
 * Auto-fallback chain:
 *   1. Nano Banana (Gemini 2.5 Flash Image) — the production path once the
 *      Gemini key has image quota (billing enabled).
 *   2. Cloudflare Workers AI (Flux) — free-tier fallback used in dev / before
 *      Gemini billing is on. Reuses the Cloudflare account id stored as
 *      `r2_account_id`, plus a Workers AI token (`cloudflare_ai_token`).
 *
 * Both are the sanctioned non-Anthropic image path, scoped to the children's
 * games — the CMS chatbot + admin AI Assist still go through the Claude Agent
 * SDK only (see CLAUDE.md). Keys come from the encrypted vault, never the
 * browser. Returns null when no provider is configured or all error, so callers
 * degrade gracefully (mirrors `askClaude` in src/lib/ai.ts).
 */
import { getCredential } from "@/lib/secrets";
import { getR2Config, uploadToR2 } from "@/lib/r2";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const CF_MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Allowlisted art styles. The value is server-side templated into the prompt. */
export const ART_STYLES = {
  cartoon: "fun bright cartoon style",
  watercolor: "soft watercolour painting style",
  pixel: "colourful retro pixel-art style",
  crayon: "playful child's crayon-drawing style",
  scifi: "friendly colourful sci-fi illustration style",
} as const;

export type ArtStyle = keyof typeof ART_STYLES;

export type GeneratedImage = { base64: string; mime: string };

function buildPrompt(prompt: string, style: ArtStyle, characterAnchor?: string): string {
  const styleHint = ART_STYLES[style] ?? ART_STYLES.cartoon;
  // When a story illustrates page after page, anchor the recurring hero so it
  // reads as the SAME character each time instead of a new look per picture.
  const consistency = characterAnchor
    ? `The main character is ${characterAnchor}, drawn exactly the same way in every picture — same colours, same design, same friendly face. `
    : "";
  return (
    `A ${styleHint} picture of: ${prompt}. ` +
    consistency +
    `Child-friendly, wholesome, cheerful, nothing scary, violent or unsafe. Suitable for young children. ` +
    // Flux especially tends to render the narration as gibberish caption text —
    // state the no-text rule forcefully so the illustration stays purely visual.
    `IMPORTANT: a purely visual illustration with absolutely NO text — do not draw any letters, words, captions, labels, numbers, signs or writing anywhere in the image.`
  );
}

/** Optional generation controls. `characterAnchor` keeps a recurring hero
 *  consistent across images; `seed` makes the Cloudflare/Flux path deterministic
 *  so the same character + seed reproduces a matching look page to page. */
export type ImageOpts = { characterAnchor?: string; seed?: number };

type GeminiResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
};

/** Result of one provider attempt — the image, or a human-readable reason it failed. */
type Attempt = { image: GeneratedImage | null; note: string };

/** Nano Banana (Gemini 2.5 Flash Image). */
async function generateWithGemini(fullPrompt: string): Promise<Attempt> {
  const key = await getCredential("gemini_api_key");
  if (!key) return { image: null, note: "gemini: no key" };
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return { image: null, note: `gemini: HTTP ${res.status} ${body}` };
    }
    const data = (await res.json()) as GeminiResponse;
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) return { image: { base64: inline.data, mime: inline.mimeType || "image/png" }, note: "gemini: ok" };
    }
    return { image: null, note: "gemini: no image in response" };
  } catch (e) {
    return { image: null, note: `gemini: threw ${e instanceof Error ? e.message : String(e)}` };
  }
}

type CloudflareResponse = { result?: { image?: string }; success?: boolean };

/** Cloudflare Workers AI (Flux-1-schnell), free tier. */
async function generateWithCloudflare(fullPrompt: string, seed?: number): Promise<Attempt> {
  const [accountId, token] = await Promise.all([
    getCredential("r2_account_id"),
    getCredential("cloudflare_ai_token"),
  ]);
  if (!token) return { image: null, note: "cloudflare: no token" };
  if (!accountId) return { image: null, note: "cloudflare: no account id (set 'Cloudflare R2 — Account ID' in credentials)" };
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, steps: 4, ...(seed != null ? { seed } : {}) }),
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return { image: null, note: `cloudflare: HTTP ${res.status} ${body}` };
    }
    const data = (await res.json()) as CloudflareResponse;
    const b64 = data.result?.image;
    if (typeof b64 === "string" && b64.length > 0) return { image: { base64: b64, mime: "image/jpeg" }, note: "cloudflare: ok" };
    return { image: null, note: "cloudflare: no image in response" };
  } catch (e) {
    return { image: null, note: `cloudflare: threw ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Generate a single kid-safe image from a (already safety-checked) prompt and
 * an allowlisted style. Tries Nano Banana first, then the Cloudflare free
 * fallback. Returns the image plus a `debug` trail of each provider attempt
 * (surfaced in dev to diagnose failures; never shown to children).
 */
export async function generateKidImage(
  prompt: string,
  style: ArtStyle,
  opts: ImageOpts = {},
): Promise<{ image: GeneratedImage | null; debug: string[] }> {
  const fullPrompt = buildPrompt(prompt, style, opts.characterAnchor);
  const debug: string[] = [];

  const gemini = await generateWithGemini(fullPrompt);
  debug.push(gemini.note);
  if (gemini.image) return { image: gemini.image, debug };

  const cloudflare = await generateWithCloudflare(fullPrompt, opts.seed);
  debug.push(cloudflare.note);
  for (const note of debug) console.error("[gemini-image]", note);
  return { image: cloudflare.image, debug };
}

/**
 * Generate a kid-safe image and store it in R2, returning the public URL.
 * Returns null when generation fails OR R2 isn't configured (callers should
 * degrade gracefully — e.g. fall back to emoji illustrations). Used by the
 * storytelling route to illustrate each scene.
 */
export async function generateAndStoreKidImage(
  prompt: string,
  style: ArtStyle,
  keyPrefix: string,
  opts: ImageOpts = {},
): Promise<string | null> {
  const { image } = await generateKidImage(prompt, style, opts);
  if (!image) return null;
  // Inline data URL — used directly as a dev fallback when R2 isn't configured,
  // and as a safety net if an R2 upload fails. Production configures R2 so this
  // path isn't normally hit (data URLs are heavy to store).
  const dataUrl = `data:${image.mime};base64,${image.base64}`;
  const cfg = await getR2Config();
  if (!cfg) return dataUrl;
  const ext = image.mime.includes("jpeg") ? "jpg" : "png";
  const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    return await uploadToR2(cfg, key, Buffer.from(image.base64, "base64"), image.mime);
  } catch (e) {
    console.error("[gemini-image] store failed, returning inline", e);
    return dataUrl;
  }
}
