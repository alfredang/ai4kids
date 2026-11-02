/**
 * Plain (non-secret) portal configuration: PayNow payee + WhatsApp number.
 * Stored in the `settings` table (admin-editable) with an env-var fallback.
 */
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

async function readSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    if (row && typeof row.value === "string" && row.value.length > 0) {
      return row.value;
    }
  } catch {
    // fall through to env
  }
  return null;
}

export async function getWhatsAppNumber(): Promise<string | null> {
  return (
    (await readSetting("whatsapp_number")) ??
    process.env.WHATSAPP_NUMBER ??
    "6588666375" // Verified on tertiarycourses.com.sg, 2 November 2026.
  );
}

export type PayNowConfig = { uen: string; payeeName: string };

export async function getPayNowConfig(): Promise<PayNowConfig | null> {
  const uen =
    (await readSetting("paynow_uen")) ?? process.env.PAYNOW_UEN ?? null;
  if (!uen) return null;
  const payeeName =
    (await readSetting("paynow_payee_name")) ??
    process.env.PAYNOW_PAYEE_NAME ??
    "AI Kids Academy";
  return { uen, payeeName };
}

export async function setPortalSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as unknown as object, updatedAt: new Date() },
    });
}
