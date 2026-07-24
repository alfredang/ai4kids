import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CATEGORIES, formatPrice } from "@/lib/portal-content";
import { slugify } from "@/lib/slugify";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminPrograms() {
  const rows = await db.select().from(programs).orderBy(desc(programs.id));

  async function createProgram(formData: FormData) {
    "use server";
    await requireStaff();
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "coding");
    if (!title) return;
    await db.insert(programs).values({
      title,
      slug: slugify(title) + "-" + Math.random().toString(36).slice(2, 6),
      category: category as (typeof CATEGORIES)[number]["slug"],
      ageMin: Number(formData.get("ageMin") || 4),
      ageMax: Number(formData.get("ageMax") || 16),
      summary: String(formData.get("summary") || ""),
      emoji: String(formData.get("emoji") || "✨"),
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      published: true,
    });
    revalidatePath("/admin/programs");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Programs</h1>

      {/* Create */}
      <form action={createProgram} className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
        <input name="title" placeholder="Program title" required className="ti-input md:col-span-2" />
        <select name="category" className="ti-input">
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
        </select>
        <input name="summary" placeholder="Short blurb" className="ti-input md:col-span-2" />
        <input name="emoji" placeholder="Emoji (✨)" defaultValue="✨" className="ti-input" />
        <input name="ageMin" type="number" placeholder="Age min" defaultValue={4} className="ti-input" />
        <input name="ageMax" type="number" placeholder="Age max" defaultValue={16} className="ti-input" />
        <input name="price" type="number" step="0.01" placeholder="Price (SGD)" defaultValue={0} className="ti-input" />
        <button className="ti-btn md:col-span-3">+ Add program</button>
      </form>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-2">Program</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Ages</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Published</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="text-white">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--color-muted)]">No programs yet.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-4 py-2">{p.emoji} {p.title}</td>
                <td className="px-4 py-2">{p.category}</td>
                <td className="px-4 py-2">{p.ageMin}–{p.ageMax}</td>
                <td className="px-4 py-2">{formatPrice(p.priceCents)}</td>
                <td className="px-4 py-2">{p.published ? "✓" : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/programs/${p.id}`} className="text-cyan hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
