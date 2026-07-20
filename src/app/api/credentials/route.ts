import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import {
  getCredential,
  getCredentialSource,
  setCredential,
  clearCredential,
  type CredentialKey,
} from "@/lib/secrets";

const ALLOWED: CredentialKey[] = [
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

const payloadSchema = z.record(z.string(), z.string().min(1).max(2000));

/** Strip whitespace/CR/LF and wrapping quotes from a pasted credential value. */
function normalizeCredential(raw: string): string {
  let v = raw.replace(/\r/g, "").trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}

/** GET ?key=<credential>&reveal=1 → returns decrypted value. Admin-only. */
export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const key = url.searchParams.get("key") as CredentialKey | null;
  if (!key || !ALLOWED.includes(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  const value = await getCredential(key);
  const source = await getCredentialSource(key);
  return NextResponse.json({ ok: true, key, source, value: value ?? null });
}

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  // Special action: migrate all env-fallback values into the encrypted DB store.
  if (url.searchParams.get("action") === "migrate-env") {
    const migrated: CredentialKey[] = [];
    for (const k of ALLOWED) {
      const source = await getCredentialSource(k);
      if (source !== "env") continue;
      const value = await getCredential(k);
      if (!value) continue;
      await setCredential(k, value);
      migrated.push(k);
    }
    return NextResponse.json({ ok: true, migrated });
  }

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  for (const [key, raw] of Object.entries(parsed.data)) {
    if (!ALLOWED.includes(key as CredentialKey)) continue;
    const value = normalizeCredential(raw);
    if (!value) continue;
    await setCredential(key as CredentialKey, value);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = new URL(req.url).searchParams.get("key") as CredentialKey | null;
  if (!key || !ALLOWED.includes(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  await clearCredential(key);
  return NextResponse.json({ ok: true });
}
