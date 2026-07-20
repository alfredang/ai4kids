import { getCredential, getCredentialSource, type CredentialKey } from "@/lib/secrets";
import { CredentialsForm } from "@/components/admin/CredentialsForm";

const KEYS: CredentialKey[] = [
  "anthropic_auth_token",
  "firecrawl_api_key",
  "tavily_api_key",
  "gemini_api_key",
  "nvidia_api_key",
  "gmail_user",
  "gmail_client_id",
  "gmail_client_secret",
  "gmail_refresh_token",
  "r2_account_id",
  "r2_access_key_id",
  "r2_secret_access_key",
  "r2_bucket",
  "r2_public_url",
  "r2_endpoint",
  "cloudflare_ai_token",
  "turnstile_site_key",
  "turnstile_secret",
  "n8n_api_url",
  "n8n_api_key",
  "linkedin_client_id",
  "linkedin_client_secret",
  "linkedin_access_token",
  "linkedin_author_urn",
  "facebook_page_access_token",
  "facebook_page_id",
];

/**
 * Build a non-sensitive preview of a saved credential — first 4 + last 4 chars
 * with middle masked. Returns "••••" if the value is too short to safely show.
 */
function maskPreview(value: string | null, key: CredentialKey): string {
  if (!value) return "";
  // Email addresses are not secrets — show the local-part fully so admins can
  // tell which Gmail account is configured at a glance.
  if (key === "gmail_user" || key === "r2_bucket" || key === "r2_public_url" || key === "r2_endpoint" || key === "r2_account_id" || key === "turnstile_site_key" || key === "n8n_api_url" || key === "linkedin_client_id" || key === "linkedin_author_urn" || key === "facebook_page_id") return value;
  if (value.length <= 8) return "•".repeat(value.length);
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}••••••${tail}`;
}

export default async function CredentialsPage() {
  const entries = await Promise.all(
    KEYS.map(async (k) => {
      const [source, value] = await Promise.all([
        getCredentialSource(k),
        getCredential(k),
      ]);
      return [k, source, value] as const;
    }),
  );
  const sources = Object.fromEntries(entries.map(([k, s]) => [k, s])) as Record<
    CredentialKey,
    "db" | "env" | "none"
  >;
  const status = Object.fromEntries(
    entries.map(([k, s]) => [k, s !== "none"]),
  ) as Record<CredentialKey, boolean>;
  const previews = Object.fromEntries(
    entries.map(([k, , v]) => [k, maskPreview(v, k)]),
  ) as Record<CredentialKey, string>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Credentials</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          API keys and OAuth tokens for AI integrations and outbound email. Values are AES-256-GCM
          encrypted at rest and never returned to the browser once saved. Leave a field blank to
          keep the existing value.
        </p>
        <p className="text-xs text-(--color-muted) mt-2 font-mono">
          <span className="text-(--color-green)">ADMIN</span> = saved here ·{" "}
          <span className="text-(--color-amber)">ENV FALLBACK</span> = code is reading the
          server env var (save here to migrate) ·{" "}
          <span className="text-white/60">NOT SET</span> = feature is disabled
        </p>
      </div>
      <CredentialsForm status={status} sources={sources} previews={previews} />
    </div>
  );
}
