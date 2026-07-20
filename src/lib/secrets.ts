import crypto from "node:crypto";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt credentials");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string {
  const [ivB, tagB, encB] = blob.split(".");
  if (!ivB || !tagB || !encB) throw new Error("Invalid encrypted secret");
  const iv = Buffer.from(ivB, "base64");
  const tag = Buffer.from(tagB, "base64");
  const enc = Buffer.from(encB, "base64");
  const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export type CredentialKey =
  | "anthropic_auth_token"
  | "firecrawl_api_key"
  | "tavily_api_key"
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
  | "turnstile_secret"
  | "n8n_api_url"
  | "n8n_api_key"
  | "linkedin_client_id"
  | "linkedin_client_secret"
  | "linkedin_access_token"
  | "linkedin_author_urn"
  | "facebook_page_access_token"
  | "facebook_page_id";

/**
 * Read a credential. DB-stored encrypted value wins over the env var fallback.
 * Returns null when neither is configured.
 */
export async function getCredential(key: CredentialKey): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, `cred:${key}`))
      .limit(1);
    if (row && typeof row.value === "string" && row.value.length > 0) {
      return decryptSecret(row.value);
    }
  } catch {
    // fall through to env
  }
  const envMap: Record<CredentialKey, string | undefined> = {
    anthropic_auth_token: process.env.ANTHROPIC_AUTH_TOKEN,
    firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
    tavily_api_key: process.env.TAVILY_API_KEY,
    gemini_api_key: process.env.GEMINI_API_KEY,
    nvidia_api_key: process.env.NVIDIA_API_KEY,
    gmail_user: process.env.GMAIL_USER,
    gmail_client_id: process.env.GMAIL_CLIENT_ID,
    gmail_client_secret: process.env.GMAIL_CLIENT_SECRET,
    gmail_refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    r2_account_id: process.env.R2_ACCOUNT_ID,
    r2_access_key_id: process.env.R2_ACCESS_KEY_ID,
    r2_secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
    r2_bucket: process.env.R2_BUCKET,
    r2_public_url: process.env.R2_PUBLIC_URL,
    r2_endpoint: process.env.R2_ENDPOINT,
    cloudflare_ai_token: process.env.CLOUDFLARE_AI_TOKEN,
    turnstile_site_key: process.env.TURNSTILE_SITE_KEY,
    turnstile_secret: process.env.TURNSTILE_SECRET,
    n8n_api_url: process.env.N8N_API_URL,
    n8n_api_key: process.env.N8N_API_KEY,
    linkedin_client_id: process.env.LINKEDIN_CLIENT_ID,
    linkedin_client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    linkedin_access_token: process.env.LINKEDIN_ACCESS_TOKEN,
    linkedin_author_urn: process.env.LINKEDIN_AUTHOR_URN,
    facebook_page_access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    facebook_page_id: process.env.FACEBOOK_PAGE_ID,
  };
  return envMap[key] ?? null;
}

export async function setCredential(key: CredentialKey, plaintext: string): Promise<void> {
  const enc = encryptSecret(plaintext);
  await db
    .insert(settings)
    .values({ key: `cred:${key}`, value: enc as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: enc as unknown as object, updatedAt: new Date() },
    });
}

export async function clearCredential(key: CredentialKey): Promise<void> {
  await db.delete(settings).where(eq(settings.key, `cred:${key}`));
}

export async function isCredentialSet(key: CredentialKey): Promise<boolean> {
  return (await getCredential(key)) !== null;
}

/**
 * Per-credential source — what's actually serving this value right now?
 *  - "db": admin-saved encrypted value in the `settings` table (preferred).
 *  - "env": code-level env-var fallback is active (DB is empty, env is set).
 *  - "none": neither is set; the feature using this credential is dark.
 */
export type CredentialSource = "db" | "env" | "none";

export async function getCredentialSource(key: CredentialKey): Promise<CredentialSource> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, `cred:${key}`))
      .limit(1);
    if (row && typeof row.value === "string" && row.value.length > 0) return "db";
  } catch {
    // fall through
  }
  const envMap: Record<CredentialKey, string | undefined> = {
    anthropic_auth_token: process.env.ANTHROPIC_AUTH_TOKEN,
    firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
    tavily_api_key: process.env.TAVILY_API_KEY,
    gemini_api_key: process.env.GEMINI_API_KEY,
    nvidia_api_key: process.env.NVIDIA_API_KEY,
    gmail_user: process.env.GMAIL_USER,
    gmail_client_id: process.env.GMAIL_CLIENT_ID,
    gmail_client_secret: process.env.GMAIL_CLIENT_SECRET,
    gmail_refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    r2_account_id: process.env.R2_ACCOUNT_ID,
    r2_access_key_id: process.env.R2_ACCESS_KEY_ID,
    r2_secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
    r2_bucket: process.env.R2_BUCKET,
    r2_public_url: process.env.R2_PUBLIC_URL,
    r2_endpoint: process.env.R2_ENDPOINT,
    cloudflare_ai_token: process.env.CLOUDFLARE_AI_TOKEN,
    turnstile_site_key: process.env.TURNSTILE_SITE_KEY,
    turnstile_secret: process.env.TURNSTILE_SECRET,
    n8n_api_url: process.env.N8N_API_URL,
    n8n_api_key: process.env.N8N_API_KEY,
    linkedin_client_id: process.env.LINKEDIN_CLIENT_ID,
    linkedin_client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    linkedin_access_token: process.env.LINKEDIN_ACCESS_TOKEN,
    linkedin_author_urn: process.env.LINKEDIN_AUTHOR_URN,
    facebook_page_access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    facebook_page_id: process.env.FACEBOOK_PAGE_ID,
  };
  return envMap[key] ? "env" : "none";
}
