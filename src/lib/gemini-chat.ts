/**
 * Fast, kid-safe text replies for the Talking Buddy (a /learn kids game).
 *
 * Gemini Flash via REST is the PRIMARY — fast (no subprocess) and hardened with
 * strict `safetySettings`. On a Gemini *error* (quota/network) we fall back to
 * the Claude Agent SDK (slower but frontier-safe). On a Gemini *safety block* we
 * return a gentle redirect rather than escalating.
 *
 * This Gemini path is scoped to the children's games (see the
 * ai-kids-games-gemini-ok policy); the CMS chatbot + admin AI Assist still use
 * the Claude Agent SDK directly per CLAUDE.md.
 */
import { getCredential } from "@/lib/secrets";
import { askClaude } from "@/lib/ai";

const GEMINI_MODEL = "gemini-2.5-flash";
const SAFE_REDIRECT = "Let's talk about something fun instead! What do you like to play?";

// Strictest available thresholds — block even low-probability harmful content.
const SAFETY = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_LOW_AND_ABOVE" }));

type GResult = { text: string | null; blocked: boolean; note: string };

async function replyWithGemini(system: string, user: string): Promise<GResult> {
  const key = await getCredential("gemini_api_key");
  if (!key) return { text: null, blocked: false, note: "gemini: no key" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          // Disable "thinking" — 2.5 Flash otherwise spends the output-token
          // budget on reasoning and the visible reply gets cut off. Also faster.
          generationConfig: { maxOutputTokens: 256, temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
          safetySettings: SAFETY,
        }),
      },
    );
    if (!res.ok) return { text: null, blocked: false, note: `gemini: HTTP ${res.status} ${(await res.text()).slice(0, 160)}` };
    const data = await res.json();
    // A safety block on the input.
    if (data?.promptFeedback?.blockReason) {
      return { text: null, blocked: true, note: `gemini: blocked ${data.promptFeedback.blockReason}` };
    }
    const cand = data?.candidates?.[0];
    if (cand?.finishReason === "SAFETY") return { text: null, blocked: true, note: "gemini: candidate SAFETY" };
    const text = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
    return text ? { text, blocked: false, note: "gemini: ok" } : { text: null, blocked: false, note: "gemini: no text" };
  } catch (e) {
    return { text: null, blocked: false, note: `gemini: threw ${e instanceof Error ? e.message : e}` };
  }
}

export async function generateKidReply(conversation: string, system: string): Promise<string | null> {
  const g = await replyWithGemini(system, conversation);
  if (g.text) return g.text;
  if (g.blocked) {
    console.error("[gemini-chat]", g.note);
    return SAFE_REDIRECT; // don't escalate blocked content to the fallback
  }
  // Gemini errored (quota/network) — fall back to Claude (frontier-safe).
  console.error("[gemini-chat]", g.note, "→ Claude fallback");
  return askClaude(conversation, { system, model: "haiku" });
}
