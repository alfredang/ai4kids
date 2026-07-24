import { db } from "@/db";
import { categories, pages, posts } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/slugify";
import { CategoriesAdminTabs } from "@/components/admin/CategoriesAdminTabs";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

type SP = { tab?: string };

export default async function CategoriesAdmin({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "post" ? "post" : "page";

  const list = await db.select().from(categories).orderBy(asc(categories.name));

  // Counts per category — pages.category_id and posts.category_id.
  const pageCounts = await db
    .select({ id: pages.categoryId, n: sql<number>`count(*)::int` })
    .from(pages)
    .groupBy(pages.categoryId);
  const postCounts = await db
    .select({ id: posts.categoryId, n: sql<number>`count(*)::int` })
    .from(posts)
    .groupBy(posts.categoryId);
  const pageCountById = new Map(pageCounts.map((r) => [r.id, r.n]));
  const postCountById = new Map(postCounts.map((r) => [r.id, r.n]));

  const rows = list.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    type: c.type as "page" | "post",
    pageCount: pageCountById.get(c.id) ?? 0,
    postCount: postCountById.get(c.id) ?? 0,
  }));

  async function add(formData: FormData) {
    "use server";
    await requireStaff();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "post") as "page" | "post";
    if (!name) return;
    if (type !== "page" && type !== "post") return;
    await db
      .insert(categories)
      .values({ name, slug: slugify(name), type })
      .onConflictDoNothing();
    revalidatePath("/admin/categories");
    redirect(`/admin/categories?tab=${type}`);
  }

  async function update(formData: FormData) {
    "use server";
    await requireStaff();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const type = String(formData.get("type") ?? "post") as "page" | "post";
    if (!id || !name || !slug) return;
    if (type !== "page" && type !== "post") return;
    await db
      .update(categories)
      .set({ name, slug: slugify(slug), type })
      .where(eq(categories.id, id));
    revalidatePath("/admin/categories");
    redirect(`/admin/categories?tab=${type}`);
  }

  async function remove(formData: FormData) {
    "use server";
    await requireStaff();
    const id = Number(formData.get("id"));
    if (!id) return;
    // Unlink from pages and posts first to avoid FK violation.
    await db.update(pages).set({ categoryId: null }).where(eq(pages.categoryId, id));
    await db.update(posts).set({ categoryId: null }).where(eq(posts.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));
    revalidatePath("/admin/categories");
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Categories</h1>
      <CategoriesAdminTabs
        rows={rows}
        activeTab={tab}
        add={add}
        update={update}
        remove={remove}
      />
    </div>
  );
}
