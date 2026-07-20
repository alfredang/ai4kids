/**
 * Kid-safe image generation for the AI Art Studio (/learn/art).
 *
 * Auto-fallback chain (ordered fastest-first — these illustrate a kids' story
 * page by page, so speed beats fidelity):
 *   1. Cloudflare Workers AI (Flux-1-schnell) — a distilled 4-step turbo model,
 *      several times faster than FLUX.1-dev. Reuses the Cloudflare account id
 *      stored as `r2_account_id`, plus a Workers AI token (`cloudflare_ai_token`).
 *   2. NVIDIA NIM (FLUX.1-dev) — slower but higher-fidelity fallback via
 *      build.nvidia.com. Free tier, no billing required. Needs an `nvidia_api_key`.
 *
 * Both are the sanctioned non-Anthropic image path, scoped to the children's
 * games — the CMS chatbot + admin AI Assist still go through the Claude Agent
 * SDK only (see CLAUDE.md). Keys come from the encrypted vault, never the
 * browser. Returns null when no provider is configured or all error, so callers
 * degrade gracefully (mirrors `askClaude` in src/lib/ai.ts).
 */
import { getCredential } from "@/lib/secrets";
import { getR2Config, uploadToR2 } from "@/lib/r2";

const NVIDIA_ENDPOINT = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";
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

/** Emoji + variation selectors / ZWJ. Stripped from every prompt: the story
 *  prose and hero anchor carry emoji (🦊🗝️✨) that contradict the no-text rule
 *  below, and the schnell model tends to render them as literal glyphs. */
const stripEmoji = (s: string): string =>
  s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

function buildPrompt(prompt: string, style: ArtStyle, characterAnchor?: string): string {
  const styleHint = ART_STYLES[style] ?? ART_STYLES.cartoon;
  // When a story illustrates page after page, anchor the recurring hero so it
  // reads as the SAME character each time instead of a new look per picture.
  // Pure txt2img (no reference image on the free NVIDIA/Cloudflare endpoints)
  // can't guarantee identity, so we lean on the two levers it does have: an
  // identical, byte-for-byte anchor clause placed FIRST — Flux weights the
  // leading tokens most, and the varying scene would otherwise dominate — plus
  // the same seed across pages (passed by the caller).
  const anchor = characterAnchor ? stripEmoji(characterAnchor) : undefined;
  const consistency = anchor
    ? `The main character is always ${anchor} — drawn in the exact same way in every picture: same colours, same design, same friendly face. `
    : "";
  return (
    consistency +
    `A ${styleHint} picture of: ${stripEmoji(prompt)}. ` +
    // Positive framing ONLY. Naming the banned concepts — even to forbid them
    // ("nothing scary, violent or unsafe") — trips FLUX.1-dev's keyword safety
    // filter, which returns a blank frame (finishReason CONTENT_FILTERED).
    // Confirmed on the Android port (device logcat); the idea is already vetted
    // upstream, so the wrapper only steers toward a wholesome look.
    //
    // No-text rule: keep it TERSE. Diffusion text encoders don't encode negation
    // well, so enumerating "letters, words, captions, signs, numbers…" makes a
    // distilled model like Cloudflare's schnell *draw* those nouns rather than omit
    // them (FLUX.1-dev was big enough to obey the long forceful version; schnell is
    // not). This short phrasing matches the Android port, which never had the
    // text-in-image regression.
    `Child-friendly, wholesome, cheerful, gentle and sweet, with no text or words in the image. Suitable for young children.`
  );
}

/** Optional generation controls. `characterAnchor` keeps a recurring hero
 *  consistent across images; `seed` makes the Cloudflare/Flux path deterministic
 *  so the same character + seed reproduces a matching look page to page. */
export type ImageOpts = { characterAnchor?: string; seed?: number };

/** Result of one provider attempt — the image, or a human-readable reason it failed. */
type Attempt = { image: GeneratedImage | null; note: string };

type NvidiaResponse = { artifacts?: { base64?: string; finishReason?: string }[] };

/** NVIDIA NIM FLUX.1-dev (build.nvidia.com), free tier — no billing required. */
async function generateWithNvidia(fullPrompt: string, seed?: number): Promise<Attempt> {
  const key = await getCredential("nvidia_api_key");
  if (!key) return { image: null, note: "nvidia: no key" };
  try {
    const res = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      // NVIDIA is now the *fallback* (Cloudflare schnell paints first when
      // configured), so favour quality over raw speed: full 1024² and 20 steps —
      // fewer than the 30 a hero image would use, but enough to avoid the soft,
      // smeared look 768² produced. FLUX returns base64 in `artifacts[0].base64`.
      body: JSON.stringify({ prompt: fullPrompt, mode: "base", cfg_scale: 5, width: 1024, height: 1024, steps: 20, ...(seed != null ? { seed } : {}) }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return { image: null, note: `nvidia: HTTP ${res.status} ${body}` };
    }
    const data = (await res.json()) as NvidiaResponse;
    const b64 = data.artifacts?.[0]?.base64;
    if (typeof b64 === "string" && b64.length > 0) return { image: { base64: b64, mime: "image/jpeg" }, note: "nvidia: ok" };
    return { image: null, note: "nvidia: no image in response" };
  } catch (e) {
    return { image: null, note: `nvidia: threw ${e instanceof Error ? e.message : String(e)}` };
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
        // 8 steps is schnell's documented max — 4 (its default) paints in a couple
        // of seconds but comes out soft/smeared; 8 is meaningfully sharper for barely
        // more time, which matters when this is the primary story painter.
        body: JSON.stringify({ prompt: fullPrompt, steps: 8, ...(seed != null ? { seed } : {}) }),
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
 * an allowlisted style. Tries the fast Cloudflare schnell path first, then the
 * slower NVIDIA FLUX.1-dev fallback. Returns the image plus a `debug` trail of
 * each provider attempt (surfaced in dev to diagnose failures; never shown to children).
 */
export async function generateKidImage(
  prompt: string,
  style: ArtStyle,
  opts: ImageOpts = {},
): Promise<{ image: GeneratedImage | null; debug: string[] }> {
  const fullPrompt = buildPrompt(prompt, style, opts.characterAnchor);
  const debug: string[] = [];

  // Fast path first: Cloudflare's 4-step schnell answers in a few seconds. Only
  // fall back to the slower NVIDIA FLUX.1-dev when it's unconfigured or errors.
  const cloudflare = await generateWithCloudflare(fullPrompt, opts.seed);
  debug.push(cloudflare.note);
  if (cloudflare.image) return { image: cloudflare.image, debug };

  const nvidia = await generateWithNvidia(fullPrompt, opts.seed);
  debug.push(nvidia.note);
  for (const note of debug) console.error("[kid-image]", note);
  return { image: nvidia.image, debug };
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
    console.error("[kid-image] store failed, returning inline", e);
    return dataUrl;
  }
}
