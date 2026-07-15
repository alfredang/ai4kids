/**
 * Speech-to-text for the Talking Buddy via Cloudflare Workers AI Whisper.
 *
 * Uses whisper-large-v3-turbo (more accurate than the base model) with the
 * language pinned to English, which markedly improves short / single-word
 * utterances. Keeps the child's audio on infra we control and works in every
 * browser. Returns the transcript, or null on failure so the client degrades.
 */
import { getCredential } from "@/lib/secrets";

const CF_STT_MODEL = "@cf/openai/whisper-large-v3-turbo";

type WhisperResponse = { result?: { text?: string }; text?: string };

export async function transcribeKidAudio(audio: ArrayBuffer): Promise<string | null> {
  const [acct, token] = await Promise.all([
    getCredential("r2_account_id"),
    getCredential("cloudflare_ai_token"),
  ]);
  if (!token || !acct) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_STT_MODEL}`;
  const base64 = Buffer.from(audio).toString("base64");

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // turbo takes base64 audio + optional hints; English + transcribe task.
        body: JSON.stringify({ audio: base64, task: "transcribe", language: "en" }),
      });
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue; // transient — retry
      }
      if (!res.ok) {
        console.error("[whisper] HTTP", res.status, (await res.text()).slice(0, 200));
        return null;
      }
      const data = (await res.json()) as WhisperResponse;
      const text = (data?.result?.text ?? data?.text ?? "").trim();
      return text || null;
    } catch (e) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 400 * attempt)); continue; }
      console.error("[whisper] threw", e);
      return null;
    }
  }
  return null;
}
