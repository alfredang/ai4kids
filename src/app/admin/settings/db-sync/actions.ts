"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { reloadScheduler } from "@/lib/scheduler";
import { runFullSync } from "@/lib/sync-jobs/full-sync";
import { requireStaff } from "@/lib/admin-guard";

async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as object, updatedAt: new Date() },
    });
}

export async function saveDbSync(formData: FormData): Promise<void> {
  await requireStaff();
  const enabled = formData.get("enabled") === "on";
  const cronExpr = String(formData.get("cron") ?? "0 * * * *").trim();
  await setSetting("db_sync_enabled", enabled);
  await setSetting("db_sync_cron", cronExpr);
  try {
    await reloadScheduler();
  } catch (err) {
    console.error("[db-sync] reload failed:", err);
  }
  revalidatePath("/admin/settings/db-sync");
  redirect("/admin/settings/db-sync?saved=1");
}

export async function runSyncNow(): Promise<void> {
  await requireStaff();
  const result = await runFullSync("manual");
  await setSetting("db_sync_last_run", { at: new Date().toISOString(), ...result });
  console.log("[db-sync] manual run:", result);
  revalidatePath("/admin/settings/db-sync");
  const flag =
    result.status === "ok" ? "ran=1" : result.status === "skipped" ? "ran=skip" : "ran=err";
  redirect(`/admin/settings/db-sync?${flag}`);
}
