import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, parentChildren } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminPeople() {
  const parents = await db.select().from(users).where(eq(users.role, "parent"));
  const kids = await db.select().from(users).where(eq(users.role, "learner"));
  const links = await db
    .select({
      id: parentChildren.id,
      parentId: parentChildren.parentId,
      childId: parentChildren.childId,
    })
    .from(parentChildren);

  const kidName = new Map(kids.map((k) => [k.id, k.name]));
  const linksByParent = new Map<number, string[]>();
  for (const l of links) {
    const arr = linksByParent.get(l.parentId) ?? [];
    arr.push(kidName.get(l.childId) ?? `#${l.childId}`);
    linksByParent.set(l.parentId, arr);
  }

  async function link(formData: FormData) {
    "use server";
    await requireStaff();
    const parentId = Number(formData.get("parentId"));
    const childId = Number(formData.get("childId"));
    if (!parentId || !childId) return;
    await db.insert(parentChildren).values({ parentId, childId }).onConflictDoNothing();
    revalidatePath("/admin/people");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Kids & Parents</h1>

      {/* Link form */}
      <form action={link} className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
        <select name="parentId" required className="ti-input">
          <option value="">Parent…</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
        </select>
        <select name="childId" required className="ti-input">
          <option value="">Kid…</option>
          {kids.map((k) => <option key={k.id} value={k.id}>{k.name} (@{k.username})</option>)}
        </select>
        <button className="ti-btn">Link kid to parent</button>
      </form>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Parents ({parents.length})</h2>
          <div className="mt-2 space-y-2">
            {parents.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-white">{p.name}</div>
                <div className="text-xs text-[var(--color-muted)]">{p.email}</div>
                <div className="mt-1 text-xs text-cyan">
                  Kids: {(linksByParent.get(p.id) ?? []).join(", ") || "none linked"}
                </div>
              </div>
            ))}
            {parents.length === 0 && <p className="text-sm text-[var(--color-muted)]">No parents yet.</p>}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Kids ({kids.length})</h2>
          <div className="mt-2 space-y-2">
            {kids.map((k) => (
              <div key={k.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-white">{k.avatar ?? "🧒"} {k.name}</div>
                <div className="text-xs text-[var(--color-muted)]">@{k.username} · ages {k.ageGroup ?? "?"}</div>
              </div>
            ))}
            {kids.length === 0 && <p className="text-sm text-[var(--color-muted)]">No kids yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
