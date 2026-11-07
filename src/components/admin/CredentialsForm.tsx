"use client";

import { useState, useTransition } from "react";

type Key =
  | "anthropic_auth_token"
  | "deepseek_api_key"
  | "gemini_api_key"
  | "nvidia_api_key"
  | "gmail_user"
  | "gmail_client_id"
  | "gmail_client_secret"
  | "gmail_refresh_token"
  | "r2_account_id"
  | "r2_access_key_id"
  | "r2_secret_access_key"
  | "r2_bucket"
  | "r2_public_url"
  | "r2_endpoint"
  | "cloudflare_ai_token"
  | "turnstile_site_key"
  | "turnstile_secret";

type Group = { title: string; description?: string; keys: Key[] };

const FIELDS: Record<
  Key,
  { label: string; hint: string; placeholder: string; type?: "email" | "text" }
> = {
  anthropic_auth_token: {
    label: "Claude (Anthropic) — OAuth subscription token",
    hint: "Generate locally with `claude setup-token`. Powers admin AI Assist and the AI chatbot via the Claude Agent SDK.",
    placeholder: "sk-ant-oat01-…",
  },
  deepseek_api_key: {
    label: "DeepSeek — API key (kids AI text games)",
    hint: "Powers parent-unlocked Talking Buddy, phonics and story generation with DeepSeek V4.1 Flash (deepseek-flash). Image and voice providers are separate.",
    placeholder: "Enter your DeepSeek API key",
  },
  gemini_api_key: {
    label: "Google Gemini — API key (image / voice fallback)",
    hint: "From Google AI Studio → Get API key. Used for image generation and a richer TTS voice fallback. Used only for the children's games, not the CMS chatbot.",
    placeholder: "AIza…",
  },
  nvidia_api_key: {
    label: "NVIDIA NIM — API key (kids AI Art Studio, free image fallback)",
    hint: "From build.nvidia.com → any model → Get API Key (starts nvapi-). Powers FLUX.1-dev image generation in the /learn AI Art Studio as a free fallback when Nano Banana has no quota. Used only for the children's games, not the CMS chatbot.",
    placeholder: "nvapi-…",
  },
  cloudflare_ai_token: {
    label: "Cloudflare Workers AI — API token (free image fallback)",
    hint: "From Cloudflare → AI → Workers AI → API Tokens (Workers AI read/run). Free-tier image generation used by the AI Art Studio when Gemini has no quota. Reuses the Account ID from the R2 settings below.",
    placeholder: "v1.0-…",
  },
  gmail_user: {
    label: "Gmail — Sender address",
    hint: "The Gmail address that the OAuth refresh token belongs to. Lead emails are sent from this account.",
    placeholder: "you@yourdomain.com",
    type: "email",
  },
  gmail_client_id: {
    label: "Gmail — OAuth Client ID",
    hint: "From the Google Cloud OAuth 2.0 client used to mint the refresh token below.",
    placeholder: "xxxxxxxx.apps.googleusercontent.com",
  },
  gmail_client_secret: {
    label: "Gmail — OAuth Client Secret",
    hint: "Pairs with the Client ID above.",
    placeholder: "GOCSPX-…",
  },
  gmail_refresh_token: {
    label: "Gmail — OAuth Refresh Token",
    hint: "Long-lived refresh token from OAuth Playground or your own consent flow. Used to mint short-lived access tokens for SMTP.",
    placeholder: "1//04…",
  },
  r2_account_id: {
    label: "Cloudflare R2 — Account ID",
    hint: "Your Cloudflare account ID (visible on the R2 overview page).",
    placeholder: "2cf6c5ccbfb5e46dbb3b8b5396867fc0",
  },
  r2_access_key_id: {
    label: "Cloudflare R2 — Access Key ID",
    hint: "From R2 → Manage API Tokens → Create Account API token (Object Read & Write).",
    placeholder: "99f2…",
  },
  r2_secret_access_key: {
    label: "Cloudflare R2 — Secret Access Key",
    hint: "Pairs with the Access Key ID above. Shown only once on token creation.",
    placeholder: "a541…",
  },
  r2_bucket: {
    label: "Cloudflare R2 — Bucket name",
    hint: "The bucket where uploaded images and files are stored.",
    placeholder: "tertiary-media",
  },
  r2_public_url: {
    label: "Cloudflare R2 — Public URL",
    hint: "Public R2.dev URL (or custom domain) used to serve uploads to the public site.",
    placeholder: "https://pub-…r2.dev",
  },
  r2_endpoint: {
    label: "Cloudflare R2 — S3 Endpoint",
    hint: "S3-compatible endpoint for write operations (auto-derived from Account ID if blank).",
    placeholder: "https://<account>.r2.cloudflarestorage.com",
  },
  turnstile_site_key: {
    label: "Cloudflare Turnstile — Site key",
    hint: "Public key embedded in the browser. Created at Cloudflare Dashboard → Turnstile → your widget (Managed mode recommended).",
    placeholder: "0x4AAAAAAA…",
  },
  turnstile_secret: {
    label: "Cloudflare Turnstile — Secret key",
    hint: "Server-side key for verifying tokens. Shown once when the widget is created.",
    placeholder: "0x4AAAAAAA…",
  },
};

const GROUPS: Group[] = [
  {
    title: "AI integrations",
    description: "API keys for Claude, the kids' AI games and image generation.",
    keys: ["anthropic_auth_token", "deepseek_api_key", "gemini_api_key", "nvidia_api_key", "cloudflare_ai_token"],
  },
  {
    title: "Gmail OAuth (lead notification email)",
    description:
      "Credentials for sending lead notifications via Gmail SMTP using OAuth 2.0 (no app password).",
    keys: ["gmail_user", "gmail_client_id", "gmail_client_secret", "gmail_refresh_token"],
  },
  {
    title: "Cloudflare R2 (image / file storage)",
    description:
      "S3-compatible object storage with zero egress fees. Uploaded blog images and media go here instead of the server disk.",
    keys: [
      "r2_account_id",
      "r2_access_key_id",
      "r2_secret_access_key",
      "r2_bucket",
      "r2_public_url",
      "r2_endpoint",
    ],
  },
  {
    title: "Cloudflare Turnstile (invisible anti-spam)",
    description:
      "Invisible CAPTCHA on public lead forms. Leave blank to disable verification (forms still work).",
    keys: ["turnstile_site_key", "turnstile_secret"],
  },
];

type Source = "db" | "env" | "none";
type Props = {
  status: Record<Key, boolean>;
  sources?: Record<Key, Source>;
  /** First-4/last-4 masked preview of each saved credential. */
  previews?: Partial<Record<Key, string>>;
};

const SOURCE_PILL: Record<Source, { label: string; className: string; title: string }> = {
  db: {
    label: "ADMIN",
    className: "bg-(--color-green)/15 text-(--color-green) border-(--color-green)/30",
    title: "Encrypted value saved via this admin UI (preferred).",
  },
  env: {
    label: "ENV FALLBACK",
    className: "bg-(--color-amber)/15 text-(--color-amber) border-(--color-amber)/40",
    title: "DB has no value — code is using the server env-var fallback. Save here to migrate.",
  },
  none: {
    label: "NOT SET",
    className: "bg-white/5 text-white/50 border-white/15",
    title: "No value in DB or env. The feature using this credential is disabled.",
  },
};

export function CredentialsForm({ status, sources, previews }: Props) {
  const [values, setValues] = useState<Record<Key, string>>(
    Object.fromEntries(Object.keys(FIELDS).map((k) => [k, ""])) as Record<Key, string>,
  );
  const [revealed, setRevealed] = useState<Record<Key, string | null>>(
    Object.fromEntries(Object.keys(FIELDS).map((k) => [k, null])) as Record<Key, string | null>,
  );
  const [revealing, setRevealing] = useState<Record<Key, boolean>>(
    Object.fromEntries(Object.keys(FIELDS).map((k) => [k, false])) as Record<Key, boolean>,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [migrating, setMigrating] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  async function testEmail() {
    setTestingEmail(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/test-email", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        sentTo?: string;
        error?: string;
        recipient?: string;
      };
      if (res.ok && data.ok) {
        setMsg(`Test email sent to ${data.sentTo}. Check the inbox.`);
      } else {
        setMsg(`Email failed: ${data.error ?? "unknown error"}`);
      }
    } catch (e) {
      setMsg(`Email failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTestingEmail(false);
    }
  }

  function submit() {
    startTransition(async () => {
      setMsg(null);
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v.trim().length > 0),
      );
      if (Object.keys(payload).length === 0) {
        setMsg("Nothing to save — fill in at least one field.");
        return;
      }
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMsg("Saved.");
        setValues(
          Object.fromEntries(Object.keys(FIELDS).map((k) => [k, ""])) as Record<Key, string>,
        );
        // refresh status badges
        setTimeout(() => window.location.reload(), 600);
      } else {
        setMsg(`Error: ${await res.text()}`);
      }
    });
  }

  async function toggleReveal(k: Key) {
    if (revealed[k] !== null) {
      setRevealed((r) => ({ ...r, [k]: null }));
      return;
    }
    setRevealing((r) => ({ ...r, [k]: true }));
    try {
      const res = await fetch(`/api/credentials?key=${k}`);
      if (!res.ok) {
        setMsg(`Reveal failed: ${await res.text()}`);
        return;
      }
      const json = (await res.json()) as { value: string | null };
      setRevealed((r) => ({ ...r, [k]: json.value ?? "" }));
    } finally {
      setRevealing((r) => ({ ...r, [k]: false }));
    }
  }

  async function clearKey(key: Key) {
    if (!confirm(`Remove ${key.replace(/_/g, " ")}?`)) return;
    const res = await fetch(`/api/credentials?key=${key}`, { method: "DELETE" });
    if (res.ok) window.location.reload();
    else setMsg(`Error: ${await res.text()}`);
  }

  async function migrateEnv() {
    if (!confirm("Copy all env-fallback credentials into the encrypted DB store?")) return;
    setMigrating(true);
    try {
      const res = await fetch("/api/credentials?action=migrate-env", { method: "POST" });
      if (!res.ok) {
        setMsg(`Migrate failed: ${await res.text()}`);
        return;
      }
      const json = (await res.json()) as { migrated: string[] };
      setMsg(
        json.migrated.length > 0
          ? `Migrated ${json.migrated.length} value${json.migrated.length === 1 ? "" : "s"} to DB.`
          : "Nothing to migrate — no env fallbacks active.",
      );
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setMigrating(false);
    }
  }

  const hasEnvFallback = sources
    ? Object.values(sources).some((s) => s === "env")
    : false;

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <div key={group.title} className="glass p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-lg font-semibold">{group.title}</h3>
              {group.description && (
                <p className="text-xs text-(--color-muted) mt-1">{group.description}</p>
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-7">
            {group.keys.map((k) => {
              const f = FIELDS[k];
              const isSet = status[k];
              const source: Source = sources?.[k] ?? (isSet ? "db" : "none");
              const pill = SOURCE_PILL[source];
              const reveal = revealed[k];
              const isRevealed = reveal !== null;
              const displayValue = values[k] !== "" ? values[k] : reveal ?? "";
              const inputType = !isRevealed ? "password" : f.type === "email" ? "email" : "text";
              return (
                <div key={k} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{f.label}</label>
                    <span
                      title={pill.title}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={inputType}
                      value={displayValue}
                      onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                      placeholder={isSet ? previews?.[k] || "•••••••• (unchanged)" : f.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full px-4 py-3 pr-24 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition font-mono text-sm"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      {isSet && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(k)}
                          disabled={revealing[k]}
                          aria-label={isRevealed ? "Hide" : "Show"}
                          title={isRevealed ? "Hide" : "Show saved value"}
                          className="px-1.5 py-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition disabled:opacity-50"
                        >
                          {revealing[k] ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : isRevealed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                              <line x1="2" y1="2" x2="22" y2="22" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      )}
                      {isSet && (
                        <button
                          type="button"
                          onClick={() => clearKey(k)}
                          aria-label="Remove"
                          className="px-1.5 py-1 text-red-400 hover:bg-red-500/15 rounded transition"
                          title="Remove stored value"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-(--color-muted)">{f.hint}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {hasEnvFallback && (
        <div className="glass p-4 flex items-center justify-between gap-4 flex-wrap border border-(--color-amber)/30">
          <p className="text-sm text-(--color-amber)">
            <strong>One-click migration:</strong> some credentials are still
            being served by server env vars. Copy them into the encrypted DB
            store so this admin is the only source of truth.
          </p>
          <button
            type="button"
            onClick={migrateEnv}
            disabled={migrating}
            className="px-4 py-2 rounded-lg border border-(--color-amber)/40 text-(--color-amber) hover:bg-(--color-amber)/10 text-sm font-mono disabled:opacity-50"
          >
            {migrating ? "Migrating…" : "Migrate env values to DB"}
          </button>
        </div>
      )}

      <div className="glass p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={submit} disabled={pending} className="btn-primary disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={testEmail}
            disabled={testingEmail}
            className="px-4 py-2 rounded-lg border border-white/15 text-sm font-mono text-white/80 hover:border-(--color-cyan)/50 hover:text-(--color-cyan) hover:bg-(--color-cyan)/5 transition disabled:opacity-50"
            title="Send a diagnostic email through the Gmail OAuth pipeline and surface any error."
          >
            {testingEmail ? "Sending…" : "Send test email"}
          </button>
          {msg && <span className="text-xs text-(--color-cyan) font-mono max-w-md break-words">{msg}</span>}
        </div>
        <p className="text-xs text-(--color-muted) font-mono">
          [ ENCRYPTED AT REST · AES-256-GCM ]
        </p>
      </div>
    </div>
  );
}
