/**
 * Speech-to-text for the Talking Buddy via Cloudflare Workers AI Whisper.
 *
 * Unlike the browser Web Speech API (which uploads a child's audio to the
 * browser vendor, Chrome/Edge-only), this keeps the audio on infrastructure we
 * control and works in every browser. Same credentials as image/TTS. Returns
 * the transcript, or null on failure so the client can degrade gracefully.
 */
import { getCredential } from "@/lib/secrets";

const CF_STT_MODEL = "@cf/openai/whisper";

export async function transcribeKidAudio(audio: ArrayBuffer): Promise<string | null> {
  const [acct, token] = await Promise.all([
    getCredential("r2_account_id"),
    getCredential("cloudflare_ai_token"),
  ]);
  if (!token || !acct) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_STT_MODEL}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body: audio, // Whisper accepts the raw audio bytes as the request body
      });
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue; // transient — retry
      }
      if (!res.ok) {
        console.error("[whisper] HTTP", res.status, (await res.text()).slice(0, 200));
        return null;
      }
      const data = await res.json();
      const text = (data?.result?.text ?? "").trim();
      return text || null;
    } catch (e) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 400 * attempt)); continue; }
      console.error("[whisper] threw", e);
      return null;
    }
  }
  return null;
}
