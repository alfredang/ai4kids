import { db } from "@/db";
import { menus, menuItems } from "@/db/schema";
import { asc, eq, count as drizzleCount } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { MenuBuilder } from "@/components/admin/MenuBuilder";
import { requireStaff } from "@/lib/admin-guard";

export default async function MenusAdmin() {
  const allMenus = await db.select().from(menus);

  async function addItem(formData: FormData) {
    "use server";
    await requireStaff();
    const menuId = Number(formData.get("menuId"));
    const label = String(formData.get("label") ?? "").trim();
    const href = String(formData.get("href") ?? "").trim();
    if (!menuId || !label || !href) return;
    const [row] = await db
      .select({ c: drizzleCount() })
      .from(menuItems)
      .where(eq(menuItems.menuId, menuId));
    await db.insert(menuItems).values({
      menuId,
      label,
      href,
      sortOrder: row?.c ?? 999,
    });
    revalidatePath("/admin/menus");
    revalidatePath("/");
  }

  async function deleteItem(formData: FormData) {
    "use server";
    await requireStaff();
    const id = Number(formData.get("id"));
    if (!id) return;
    await db.delete(menuItems).where(eq(menuItems.id, id));
    revalidatePath("/admin/menus");
    revalidatePath("/");
  }

  async function saveOrder(
    menuId: number,
    order: { id: number; parentId: number | null; sortOrder: number }[],
  ) {
    "use server";
    await requireStaff();
    if (!menuId || !Array.isArray(order)) return;
    // Validate every id in order belongs to this menu (defense in depth).
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.menuId, menuId));
    const allowed = new Set(existing.map((r) => r.id));
    for (const o of order) {
      if (!allowed.has(o.id)) continue;
      if (o.parentId !== null && !allowed.has(o.parentId)) continue;
      await db
        .update(menuItems)
        .set({ parentId: o.parentId, sortOrder: o.sortOrder })
        .where(eq(menuItems.id, o.id));
    }
    revalidatePath("/admin/menus");
    revalidatePath("/");
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Menus</h1>
      <p className="text-sm text-(--color-muted)">
        Drag the <span className="font-mono">⠿</span> handle to reorder. Use the → arrow to nest an
        item under the one above it; ← to outdent back to top-level. Click <strong>Save order</strong>{" "}
        to persist.
      </p>
      {await Promise.all(
        allMenus.map(async (m) => {
          const items = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.menuId, m.id))
            .orderBy(asc(menuItems.sortOrder));
          return (
            <section key={m.id} className="glass rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">
                {m.name} <span className="text-sm text-white/50">({m.location})</span>
              </h2>
              <MenuBuilder
                menuId={m.id}
                items={items.map((it) => ({
                  id: it.id,
                  label: it.label,
                  href: it.href,
                  parentId: it.parentId,
                  sortOrder: it.sortOrder,
                }))}
                saveOrder={saveOrder}
                addItem={addItem}
                deleteItem={deleteItem}
              />
            </section>
          );
        }),
      )}
    </div>
  );
}
