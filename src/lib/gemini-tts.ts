/**
 * Kid-safe text-to-speech for the Talking Buddy. Same auto-fallback shape as
 * gemini-image.ts: Gemini TTS first (prod), Cloudflare Deepgram Aura fallback
 * (free-tier / dev). Returns { base64, mime } playable in an <audio>, or null.
 */
import { getCredential } from "@/lib/secrets";
import { stripForSpeech } from "@/lib/strip-emoji";

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
// Deepgram Aura on Workers AI — supports named voices via `speaker` and returns
// binary MP3. `luna` is a warm, gentle voice suited to a kids buddy.
const CF_TTS_MODEL = "@cf/deepgram/aura-1";
const CF_TTS_VOICE = "thalia";

export type Speech = { base64: string; mime: string };
type Attempt = { audio: Speech | null; note: string };

/** Wrap raw 16-bit PCM (Gemini returns audio/L16) in a WAV header so browsers can play it. */
function pcmToWav(pcm: Buffer, rate = 24000, ch = 1, bits = 16): Buffer {
  const blockAlign = (ch * bits) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * blockAlign, 28); h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bits, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function speakWithGemini(text: string): Promise<Attempt> {
  const key = await getCredential("gemini_api_key");
  if (!key) return { audio: null, note: "gemini: no key" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say warmly and cheerfully for a young child: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
          },
        }),
      },
    );
    if (!res.ok) return { audio: null, note: `gemini: HTTP ${res.status} ${(await res.text()).slice(0, 200)}` };
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) return { audio: null, note: "gemini: no audio" };
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24000);
    const wav = pcmToWav(Buffer.from(part.data, "base64"), rate);
    return { audio: { base64: wav.toString("base64"), mime: "audio/wav" }, note: "gemini: ok" };
  } catch (e) {
    return { audio: null, note: `gemini: threw ${e instanceof Error ? e.message : e}` };
  }
}

async function speakWithCloudflare(text: string): Promise<Attempt> {
  const [acct, token] = await Promise.all([getCredential("r2_account_id"), getCredential("cloudflare_ai_token")]);
  if (!token) return { audio: null, note: "cloudflare: no token" };
  if (!acct) return { audio: null, note: "cloudflare: no account id" };
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_TTS_MODEL}`;
  // Aura occasionally returns transient 5xx; retry a couple times so we don't
  // keep flapping back to the browser voice.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: CF_TTS_VOICE }),
      });
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue; // transient server error — retry
      }
      if (!res.ok) return { audio: null, note: `cloudflare: HTTP ${res.status} ${(await res.text()).slice(0, 200)}` };
      // Aura returns binary MP3 audio (not JSON).
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return { audio: null, note: "cloudflare: empty audio" };
      return { audio: { base64: buf.toString("base64"), mime: "audio/mpeg" }, note: "cloudflare: ok" };
    } catch (e) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 400 * attempt)); continue; }
      return { audio: null, note: `cloudflare: threw ${e instanceof Error ? e.message : e}` };
    }
  }
  return { audio: null, note: "cloudflare: 5xx after retries" };
}

export async function generateKidSpeech(text: string): Promise<Speech | null> {
  const clean = stripForSpeech(text);
  if (!clean) return null; // nothing speakable (e.g. an emoji-only reply)
  const g = await speakWithGemini(clean);
  if (g.audio) return g.audio;
  const c = await speakWithCloudflare(clean);
  for (const n of [g.note, c.note]) console.error("[gemini-tts]", n);
  return c.audio;
}
