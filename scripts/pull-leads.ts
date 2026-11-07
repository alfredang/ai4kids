/**
 * Pull-only mirror for the `leads` table from production to local.
 * - Reads remote IDs via GET /api/admin/sync/leads (bearer or basic auth, same
 *   as the rest of /api/admin/sync).
 * - Deletes any local lead whose ID is NOT in the remote set.
 * - NEVER pushes local changes upward; this script is one-way.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/pull-leads.ts
 */
import { db } from "../src/db";
import { leads } from "../src/db/schema";
import { inArray } from "drizzle-orm";

const REMOTE = process.env.REMOTE_SYNC_URL ?? "https://ai4kids.tertiarycourses.com.sg";
const TOKEN = process.env.SYNC_API_TOKEN;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

function authHeader(): string {
  if (TOKEN) return `Bearer ${TOKEN}`;
  if (EMAIL && PASSWORD) return `Basic ${Buffer.from(`${EMAIL}:${PASSWORD}`).toString("base64")}`;
  throw new Error("Set SYNC_API_TOKEN or ADMIN_EMAIL+ADMIN_PASSWORD in env");
}

type RemoteLead = { id: number; email: string; createdAt: string };

async function main() {
  const res = await fetch(`${REMOTE}/api/admin/sync/leads`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Remote responded ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { ok: boolean; leads: RemoteLead[] };
  const remoteIds = new Set(data.leads.map((l) => l.id));
  console.log(`Remote leads: ${remoteIds.size}`);

  const local = await db.select({ id: leads.id, email: leads.email }).from(leads);
  console.log(`Local leads: ${local.length}`);

  const toDelete = local.filter((l) => !remoteIds.has(l.id)).map((l) => l.id);
  if (toDelete.length === 0) {
    console.log("✓ Local already mirrors remote");
    return;
  }
  console.log(`Deleting ${toDelete.length} stale local lead(s):`);
  const stale = local.filter((l) => toDelete.includes(l.id));
  for (const s of stale) console.log(`  - #${s.id} ${s.email}`);
  await db.delete(leads).where(inArray(leads.id, toDelete));
  console.log("✓ Done");
}
main().then(() => process.exit(0));
