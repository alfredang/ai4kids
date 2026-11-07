/**
 * Branded SVG cover image for a blog post. See
 * .claude/skills/blog-cover-image/SKILL.md for the rules every change here
 * must respect.
 *
 * Canvas is 16:10 to match the blog index card aspect — anything wider gets
 * center-cropped by object-cover. Font family is plain sans-serif because
 * sharp/libvips's SVG renderer does NOT load webfonts and silently falls
 * back to its default; specifying "Inter" etc. makes glyphs wider than
 * planned and breaks the safe-area assumptions.
 */
import sharp from "sharp";
import { uploadToR2, type R2Config } from "@/lib/r2";

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 750;
export const COVER_PADDING_X = 100;
const SAFE_TEXT_WIDTH = COVER_WIDTH - COVER_PADDING_X * 2;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toTitleCase(s: string): string {
  return s.replace(/[\p{L}\d][\p{L}\d'’.]*/gu, (w) => {
    if (/\d/.test(w)) return w;
    if (/[A-Z]/.test(w)) return w;
    return w[0].toUpperCase() + w.slice(1);
  });
}

function wrapTitle(title: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length) {
    const last = lines.pop() ?? "";
    lines.push(`${last.replace(/[.,;:!?]+$/, "")}…`);
  }
  return lines;
}

function fitFontSize(title: string): { fontSize: number; lineHeight: number; lines: string[] } {
  const candidates = [80, 72, 64, 56, 48, 42, 36];
  const charWidthRatio = 0.58;
  for (const fs of candidates) {
    const maxChars = Math.floor(SAFE_TEXT_WIDTH / (fs * charWidthRatio));
    const lines = wrapTitle(title, maxChars, 3);
    const longest = Math.max(...lines.map((l) => l.length));
    if (longest * fs * charWidthRatio <= SAFE_TEXT_WIDTH) {
      return { fontSize: fs, lineHeight: Math.round(fs * 1.15), lines };
    }
  }
  const fs = 32;
  const maxChars = Math.floor(SAFE_TEXT_WIDTH / (fs * charWidthRatio));
  const lines = wrapTitle(title, maxChars, 3);
  return { fontSize: fs, lineHeight: Math.round(fs * 1.15), lines };
}

export function buildPostCoverSvg(title: string, kicker?: string): string {
  const { fontSize, lineHeight, lines } = fitFontSize(toTitleCase(title));
  const totalTextHeight = lines.length * lineHeight;
  const startY = (COVER_HEIGHT - totalTextHeight) / 2 + fontSize * 0.8;

  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="${COVER_PADDING_X}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const kickerEl = kicker
    ? `<text x="${COVER_PADDING_X}" y="${startY - fontSize - 20}" fill="#b53c72" font-family="sans-serif" font-size="20" letter-spacing="4">[ ${escapeXml(kicker.toUpperCase())} ]</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#edf7ff"/>
      <stop offset="50%" stop-color="#fff8e3"/>
      <stop offset="100%" stop-color="#f3ecfb"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#ffda70" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffda70" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="85%" cy="80%" r="55%">
      <stop offset="0%" stop-color="#a185b6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#a185b6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#a185b6" stroke-width="0.5" stroke-opacity="0"/>
    </pattern>
    <linearGradient id="text" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7a50a0"/>
      <stop offset="100%" stop-color="#b53c72"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#bg)"/>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#grid)"/>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#glow1)"/>
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="url(#glow2)"/>
  <line x1="0" y1="0" x2="${COVER_WIDTH}" y2="0" stroke="#a185b6" stroke-width="2" stroke-opacity="0.4"/>
  ${kickerEl}
  <text x="${COVER_PADDING_X}" y="${startY}" fill="url(#text)" font-family="sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-1">
    ${titleTspans}
  </text>
  <g transform="translate(${COVER_PADDING_X}, ${COVER_HEIGHT - 75})">
    <rect width="48" height="48" rx="8" fill="#ffda70" stroke="#41467d" stroke-opacity="1"/>
    <text x="24" y="32" fill="#343c79" font-family="sans-serif" font-size="20" font-weight="700" text-anchor="middle">AK</text>
    <text x="64" y="22" fill="#343c79" font-family="sans-serif" font-size="18" font-weight="600">AI Kids Academy</text>
    <text x="64" y="42" fill="#2c8c8a" font-family="sans-serif" font-size="13" letter-spacing="0.5">ai4kids.tertiarycourses.com.sg</text>
  </g>
</svg>`;
}

/** Render the SVG → PNG and upload to R2. Returns the public URL. */
export async function renderAndUploadCover(
  r2: R2Config,
  title: string,
  slug: string,
  kicker?: string,
): Promise<{ url: string; bytes: number }> {
  const svg = buildPostCoverSvg(title, kicker);
  const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  const baseSlug =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "post";
  const key = `blog/ai-${Date.now()}-${baseSlug}.png`;
  const url = await uploadToR2(r2, key, png, "image/png");
  return { url, bytes: png.byteLength };
}
