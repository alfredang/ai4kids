import { db } from "@/db";
import { leadBlocklist } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function BlocklistPage() {
  const rows = await db
    .select()
    .from(leadBlocklist)
    .orderBy(desc(leadBlocklist.createdAt));

  async function add(formData: FormData) {
    "use server";
    await requireStaff();
    const pattern = String(formData.get("pattern") ?? "").trim().toLowerCase();
    const kind = String(formData.get("kind") ?? "block");
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!pattern || (kind !== "block" && kind !== "allow")) redirect("/admin/leads/blocklist?err=invalid");
    await db
      .insert(leadBlocklist)
      .values({ pattern, kind, reason })
      .onConflictDoNothing();
    revalidatePath("/admin/leads/blocklist");
    redirect("/admin/leads/blocklist?saved=1");
  }

  async function remove(formData: FormData) {
    "use server";
    await requireStaff();
    const id = Number(formData.get("id"));
    if (id) await db.delete(leadBlocklist).where(eq(leadBlocklist.id, id));
    revalidatePath("/admin/leads/blocklist");
    redirect("/admin/leads/blocklist?saved=1");
  }

  const allows = rows.filter((r) => r.kind === "allow");
  const blocks = rows.filter((r) => r.kind === "block");

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Lead Blocklist &amp; Allowlist</h1>
          <Link href="/admin/leads" className="text-sm text-(--color-cyan) hover:underline">
            ← Back to Leads
          </Link>
        </div>
        <p className="text-sm text-white/60 max-w-3xl">
          Patterns support <code className="font-mono text-xs">*</code> and{" "}
          <code className="font-mono text-xs">?</code> wildcards on the email
          address (e.g. <code className="font-mono text-xs">*@163.com</code>,{" "}
          <code className="font-mono text-xs">spam*@*</code>). Allow rules
          override block rules — a whitelisted email is always accepted, even
          if it matches a blocklist pattern.
        </p>
      </div>

      <section className="glass rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Add rule</h2>
        <form action={add} className="grid md:grid-cols-[1fr_140px_1fr_120px] gap-3 items-end">
          <div>
            <label className="kicker block mb-2">Email pattern</label>
            <input
              name="pattern"
              required
              placeholder="*@163.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm font-mono"
            />
          </div>
          <div>
            <label className="kicker block mb-2">Kind</label>
            <select
              name="kind"
              defaultValue="block"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
            >
              <option value="block">Block</option>
              <option value="allow">Allow</option>
            </select>
          </div>
          <div>
            <label className="kicker block mb-2">Reason (optional)</label>
            <input
              name="reason"
              placeholder="e.g. mass spam from this domain"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm"
            />
          </div>
          <button className="btn-primary justify-center">Add</button>
        </form>
      </section>

      <section className="glass rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-(--color-green)">✓</span> Allowlist
          <span className="text-xs font-mono text-white/40">({allows.length})</span>
        </h2>
        {allows.length === 0 ? (
          <p className="text-sm text-white/40">No allow rules.</p>
        ) : (
          <RuleTable rows={allows} remove={remove} />
        )}
      </section>

      <section className="glass rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-red-400">✕</span> Blocklist
          <span className="text-xs font-mono text-white/40">({blocks.length})</span>
        </h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-white/40">No block rules.</p>
        ) : (
          <RuleTable rows={blocks} remove={remove} />
        )}
      </section>
    </div>
  );
}

function RuleTable({
  rows,
  remove,
}: {
  rows: { id: number; pattern: string; kind: string; reason: string | null; createdAt: Date }[];
  remove: (fd: FormData) => Promise<void>;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] uppercase text-white/60">
        <tr>
          <th className="px-2 py-2 w-[34%]">Pattern</th>
          <th className="px-2 py-2 w-[40%]">Reason</th>
          <th className="px-2 py-2 w-[16%]">Added</th>
          <th className="px-2 py-2 w-[10%] text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
            <td className="px-2 py-1.5 font-mono">{r.pattern}</td>
            <td className="px-2 py-1.5 text-white/70">{r.reason ?? "—"}</td>
            <td className="px-2 py-1.5 text-xs font-mono text-white/50">
              {new Date(r.createdAt).toLocaleDateString("en-GB")}
            </td>
            <td className="px-2 py-1.5 text-right">
              <form action={remove}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
