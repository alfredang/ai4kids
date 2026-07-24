"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { reloadScheduler } from "@/lib/scheduler";
import { runWeeklyBlogJob } from "@/lib/blog-jobs/weekly-blog";
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

export async function saveBlogSchedule(formData: FormData): Promise<void> {
  await requireStaff();
  const enabled = formData.get("enabled") === "on";
  const autoApprove = formData.get("auto_approve") === "on";
  const pushToRemote = formData.get("push_to_remote") === "on";
  const cronExpr = String(formData.get("cron") ?? "0 9 * * 0").trim();
  const channel = String(formData.get("channel") ?? "@lev-selector").trim();
  const authorId = String(formData.get("author_id") ?? "2").trim();
  const categorySlug = String(formData.get("category_slug") ?? "ai-automation").trim();

  await setSetting("blog_schedule_enabled", enabled);
  await setSetting("blog_schedule_auto_approve", autoApprove);
  await setSetting("blog_schedule_push_to_remote", pushToRemote);
  await setSetting("blog_schedule_cron", cronExpr);
  await setSetting("blog_schedule_yt_channel", channel);
  await setSetting("blog_schedule_author_id", authorId);
  await setSetting("blog_schedule_category_slug", categorySlug);

  try {
    await reloadScheduler();
  } catch (err) {
    console.error("[blog-schedule] reload failed:", err);
  }

  revalidatePath("/admin/settings/blog-schedule");
  redirect("/admin/settings/blog-schedule?saved=1");
}

export async function runNow(): Promise<void> {
  await requireStaff();
  const result = await runWeeklyBlogJob({ trigger: "manual" });
  console.log("[blog-schedule] manual run:", result);
  revalidatePath("/admin/settings/blog-schedule");
  const flag = result.status === "ok" ? "ran=1" : result.status === "skipped" ? "ran=skip" : "ran=err";
  redirect(`/admin/settings/blog-schedule?${flag}`);
}
