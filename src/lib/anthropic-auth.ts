import { tmpdir } from "os";

/**
 * Lock the Agent SDK subprocess down to just our own prompt. Spread this into
 * EVERY `query()` call — see the four call sites in src/lib/ai.ts,
 * src/lib/ai/claude.ts, src/lib/nemo-reflect.ts and /api/chat.
 *
 * `query()` defaults to full CLI behaviour: it loads all filesystem settings,
 * this repo's CLAUDE.md (~18KB), discovered skills, AND the developer's
 * per-project memory — into the context of every call, including the PUBLIC
 * anonymous chatbot. Probing the model confirmed it could recite the dev port
 * and memory file paths; the memory here holds a local Postgres URL and its
 * password. None of that belongs in a kids' story or a stranger's chat.
 *
 * All three keys are load-bearing — measured with a leak probe:
 *  - `settingSources: []` drops settings.json + CLAUDE.md, but memory STILL leaked
 *  - `skills: []` is required because omitting it is NOT "skills off" (the CLI's
 *    own defaults still apply, per the SDK docs)
 *  - `cwd` is the one that actually stops memory + project skills: both are
 *    resolved from the working directory, so it must point away from the repo.
 * Removing any one of them re-opens the leak.
 */
export const SDK_ISOLATION = {
  settingSources: [] as [],
  skills: [] as [],
  cwd: tmpdir(),
};

/**
 * Build the env record for the Claude Agent SDK subprocess.
 *
 * Subscription / OAuth tokens (prefixed `sk-ant-oat`) authenticate via
 * `CLAUDE_CODE_OAUTH_TOKEN` — the same env var Claude Code CLI reads
 * when `~/.claude/.credentials.json` isn't available. Standard API keys
 * use `ANTHROPIC_API_KEY`.
 *
 * We strip the other auth env vars so a stale value leaked in from
 * `process.env` doesn't shadow the token we actually want to use.
 */
export function buildClaudeEnv(token: string): Record<string, string | undefined> {
  const trimmed = token.trim();
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  if (trimmed.startsWith("sk-ant-oat")) {
    env.CLAUDE_CODE_OAUTH_TOKEN = trimmed;
  } else {
    env.ANTHROPIC_API_KEY = trimmed;
  }
  return env;
}
