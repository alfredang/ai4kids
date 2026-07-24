import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, programs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatPrice } from "@/lib/portal-content";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "full", "closed", "cancelled", "completed"] as const;

export default async function AdminClasses() {
  const progs = await db.select().from(programs).orderBy(programs.title);
  const rows = await db
    .select({
      c: classes,
      programTitle: programs.title,
    })
    .from(classes)
    .innerJoin(programs, eq(classes.programId, programs.id))
    .orderBy(desc(classes.id));

  async function createClass(formData: FormData) {
    "use server";
    await requireStaff();
    const programId = Number(formData.get("programId"));
    const title = String(formData.get("title") || "").trim();
    if (!programId || !title) return;
    await db.insert(classes).values({
      programId,
      title,
      schedule: String(formData.get("schedule") || ""),
      mode: String(formData.get("mode") || "online"),
      location: String(formData.get("location") || ""),
      maxStudents: Number(formData.get("maxStudents") || 8),
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      status: "open",
    });
    revalidatePath("/admin/classes");
  }

  async function setStatus(formData: FormData) {
    "use server";
    await requireStaff();
    const id = Number(formData.get("id"));
    const status = String(formData.get("status"));
    await db
      .update(classes)
      .set({ status: status as (typeof STATUSES)[number], updatedAt: new Date() })
      .where(eq(classes.id, id));
    revalidatePath("/admin/classes");
  }

  async function removeClass(formData: FormData) {
    "use server";
    await requireStaff();
    await db.delete(classes).where(eq(classes.id, Number(formData.get("id"))));
    revalidatePath("/admin/classes");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Classes</h1>

      <form action={createClass} className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
        <select name="programId" required className="ti-input">
          <option value="">Select program…</option>
          {progs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input name="title" placeholder="Class title / cohort" required className="ti-input md:col-span-2" />
        <input name="schedule" placeholder="Schedule e.g. Sat 10–12, 4 weeks" className="ti-input md:col-span-2" />
        <select name="mode" className="ti-input">
          <option value="online">Online</option>
          <option value="onsite">On-site</option>
        </select>
        <input name="location" placeholder="Location (if on-site)" className="ti-input" />
        <input name="maxStudents" type="number" defaultValue={8} placeholder="Max students" className="ti-input" />
        <input name="price" type="number" step="0.01" defaultValue={0} placeholder="Price (SGD)" className="ti-input" />
        <button className="ti-btn md:col-span-3">+ Add class</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Program</th>
              <th className="px-3 py-2">Schedule</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--color-muted)]">No classes yet.</td></tr>
            ) : rows.map(({ c, programTitle }) => (
              <tr key={c.id} className="border-t border-white/5 align-top">
                <td className="px-3 py-2">{c.title}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{programTitle}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{c.schedule || "—"}</td>
                <td className="px-3 py-2">{c.seatsTaken}/{c.maxStudents}</td>
                <td className="px-3 py-2">{formatPrice(c.priceCents)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    c.status === "open" ? "bg-green/20 text-green" :
                    c.status === "full" ? "bg-amber/20 text-amber" : "bg-white/10 text-[var(--color-muted)]"
                  }`}>{c.status}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} className="ti-input !py-1 !text-xs">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="ti-btn-ghost text-xs">Set</button>
                    </form>
                    <form action={removeClass}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-coral hover:underline">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
