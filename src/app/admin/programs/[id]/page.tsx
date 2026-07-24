import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CATEGORIES } from "@/lib/portal-content";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function EditProgram({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pid = Number(id);
  const [p] = await db.select().from(programs).where(eq(programs.id, pid)).limit(1);
  if (!p) notFound();

  async function save(formData: FormData) {
    "use server";
    await requireStaff();
    await db
      .update(programs)
      .set({
        title: String(formData.get("title") || p.title),
        category: String(formData.get("category") || p.category) as typeof p.category,
        summary: String(formData.get("summary") || ""),
        emoji: String(formData.get("emoji") || "✨"),
        ageMin: Number(formData.get("ageMin") || p.ageMin),
        ageMax: Number(formData.get("ageMax") || p.ageMax),
        priceCents: Math.round(Number(formData.get("price") || 0) * 100),
        published: formData.get("published") === "on",
        updatedAt: new Date(),
      })
      .where(eq(programs.id, pid));
    revalidatePath("/admin/programs");
    redirect("/admin/programs");
  }

  async function remove() {
    "use server";
    await requireStaff();
    await db.delete(programs).where(eq(programs.id, pid));
    redirect("/admin/programs");
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/programs" className="text-sm text-cyan hover:underline">← Programs</Link>
      <h1 className="mt-2 text-2xl font-bold text-white">Edit program</h1>

      <form action={save} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 text-sm text-[var(--color-muted)]">Title
          <input name="title" defaultValue={p.title} className="ti-input mt-1" />
        </label>
        <label className="text-sm text-[var(--color-muted)]">Category
          <select name="category" defaultValue={p.category} className="ti-input mt-1">
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-sm text-[var(--color-muted)]">Emoji
          <input name="emoji" defaultValue={p.emoji ?? "✨"} className="ti-input mt-1" />
        </label>
        <label className="md:col-span-2 text-sm text-[var(--color-muted)]">Summary
          <input name="summary" defaultValue={p.summary ?? ""} className="ti-input mt-1" />
        </label>
        <label className="text-sm text-[var(--color-muted)]">Age min
          <input name="ageMin" type="number" defaultValue={p.ageMin} className="ti-input mt-1" />
        </label>
        <label className="text-sm text-[var(--color-muted)]">Age max
          <input name="ageMax" type="number" defaultValue={p.ageMax} className="ti-input mt-1" />
        </label>
        <label className="text-sm text-[var(--color-muted)]">Price (SGD)
          <input name="price" type="number" step="0.01" defaultValue={(p.priceCents / 100).toFixed(2)} className="ti-input mt-1" />
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input name="published" type="checkbox" defaultChecked={p.published} /> Published
        </label>
        <button className="ti-btn md:col-span-2">Save changes</button>
      </form>

      <form action={remove} className="mt-4">
        <button className="text-sm text-coral hover:underline">Delete this program</button>
      </form>
    </div>
  );
}
