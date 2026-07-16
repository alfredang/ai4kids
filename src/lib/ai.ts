/**
 * Thin wrapper over the Claude Agent SDK for one-shot text generation, reusing
 * the same credential + env plumbing as the chat route. Returns null when no
 * token is configured or the SDK errors, so callers can degrade gracefully.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getCredential } from "@/lib/secrets";
import { buildClaudeEnv, SDK_ISOLATION } from "@/lib/anthropic-auth";

export async function isAiConfigured(): Promise<boolean> {
  return (await getCredential("anthropic_auth_token")) !== null;
}

export async function askClaude(
  prompt: string,
  opts: { system?: string; model?: "haiku" | "sonnet"; maxTurns?: number } = {},
): Promise<string | null> {
  const token = await getCredential("anthropic_auth_token");
  if (!token) return null;
  let resultText = "";
  let errored = false;
  try {
    for await (const msg of query({
      prompt,
      options: {
        env: buildClaudeEnv(token),
        ...SDK_ISOLATION, // keeps CLAUDE.md / skills / memory out of the prompt
        systemPrompt: opts.system,
        model: opts.model ?? "haiku",
        fallbackModel: "sonnet",
        maxTurns: opts.maxTurns ?? 1,
        allowedTools: [],
        disallowedTools: [
          "Bash",
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch",
        ],
      },
    })) {
      if (msg.type === "result") {
        const subtype = (msg as { subtype?: string }).subtype;
        const r = (msg as { result?: string }).result;
        if (subtype === "success" && r) resultText = r;
        else if (subtype && subtype !== "success") errored = true;
      }
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text" && !resultText) resultText += block.text;
        }
      }
    }
  } catch (e) {
    console.error("[ai] askClaude threw", e);
    errored = true;
  }
  if (errored || !resultText) return null;
  return resultText.trim();
}

/** Ask Claude for a JSON object and parse it; returns null on any failure. */
export async function askClaudeJson<T>(
  prompt: string,
  opts: { system?: string; model?: "haiku" | "sonnet" } = {},
): Promise<T | null> {
  const text = await askClaude(prompt, opts);
  if (!text) return null;
  // Strip code fences if present.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find the first {...} or [...] block.
    const match = cleaned.match(/[[{][\s\S]*[}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
