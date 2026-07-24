import { db } from "@/db";
import { tags, postTags } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/slugify";
import { TagsAdminTable } from "@/components/admin/TagsAdminTable";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function TagsAdmin() {
  const [list, counts] = await Promise.all([
    db.select().from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId, count: sql<number>`count(*)::int` })
      .from(postTags)
      .groupBy(postTags.tagId),
  ]);
  const countByTagId = new Map<number, number>(counts.map((c) => [c.tagId, c.count]));
  const rows = list.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    count: countByTagId.get(t.id) ?? 0,
  }));

  async function add(formData: FormData) {
    "use server";
    await requireStaff();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await db.insert(tags).values({ name, slug: slugify(name) }).onConflictDoNothing();
    revalidatePath("/admin/tags");
  }
  async function remove(id: number) {
    "use server";
    await requireStaff();
    if (!id) return;
    await db.delete(tags).where(eq(tags.id, id));
    revalidatePath("/admin/tags");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <span className="text-sm text-white/50 font-mono">[ {rows.length} total ]</span>
      </div>
      <form action={add} className="glass rounded-xl p-4 flex gap-2 mb-6">
        <input
          name="name"
          placeholder="New tag name"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder:text-white/30 focus:outline-none focus:border-(--color-cyan)/40"
        />
        <button className="px-4 py-2 rounded bg-(--color-cyan)/15 border border-(--color-cyan)/40 hover:bg-(--color-cyan)/25 text-sm">
          Add
        </button>
      </form>
      <TagsAdminTable rows={rows} remove={remove} />
    </div>
  );
}
