import { db } from "@/db";
import { pages, categories } from "@/db/schema";
import { asc, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PagesBulkTable, type PageRow } from "@/components/admin/PagesBulkTable";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function PagesList() {
  const [list, allCats] = await Promise.all([
    db.select().from(pages).orderBy(desc(pages.updatedAt)),
    db.select().from(categories).orderBy(asc(categories.name)),
  ]);
  const catById = new Map(allCats.map((c) => [c.id, c]));

  async function createPage() {
    "use server";
    await requireStaff();
    const [p] = await db
      .insert(pages)
      .values({
        slug: `untitled-${Date.now()}`,
        title: "Untitled page",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        status: "draft",
      })
      .returning();
    revalidatePath("/admin/pages");
    redirect(`/admin/pages/${p.id}/edit`);
  }

  async function deleteMany(ids: number[]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return;
    await db.delete(pages).where(inArray(pages.id, ids));
    revalidatePath("/admin/pages");
  }

  async function updateStatus(ids: number[], status: PageRow["status"]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return;
    if (!["draft", "published", "archived"].includes(status)) return;
    await db.update(pages).set({ status }).where(inArray(pages.id, ids));
    revalidatePath("/admin/pages");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Pages</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50 font-mono">[ {list.length} total ]</span>
          <form action={createPage}>
            <button className="btn-primary">+ New Page</button>
          </form>
        </div>
      </div>
      <PagesBulkTable
        rows={list.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          status: p.status,
          updatedAt: p.updatedAt.toISOString(),
          category: p.categoryId ? catById.get(p.categoryId)?.name ?? null : null,
          categorySlug: p.categoryId ? catById.get(p.categoryId)?.slug ?? null : null,
        }))}
        categories={allCats.map((c) => ({ slug: c.slug, name: c.name }))}
        deleteMany={deleteMany}
        updateStatus={updateStatus}
      />
    </div>
  );
}
