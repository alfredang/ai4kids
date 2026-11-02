import type { MetadataRoute } from "next";
import { db } from "@/db";
import { programs, posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HOLIDAY_WORKSHOPS } from "@/lib/holiday-workshops";

const BASE = "https://ai4kids.tertiarycourses.com.sg";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [allPrograms, allPosts] = await Promise.all([
    db.select().from(programs).where(eq(programs.published, true)).catch(() => []),
    db.select().from(posts).where(eq(posts.status, "published")).catch(() => []),
  ]);
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    ...HOLIDAY_WORKSHOPS.map((workshop) => ({
      url: `${BASE}/holiday-workshops/${workshop.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${BASE}/games`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/programs`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/free-trial`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/blog/tags`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...allPrograms.map((p) => ({
      url: `${BASE}/programs/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...allPosts.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
