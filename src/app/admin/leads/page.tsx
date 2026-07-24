import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { LeadsBulkTable, type LeadRow } from "@/components/admin/LeadsBulkTable";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function LeadsList() {
  const list = await db.select().from(leads).orderBy(desc(leads.createdAt));

  async function deleteMany(ids: number[]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return;
    await db.delete(leads).where(inArray(leads.id, ids));
    revalidatePath("/admin/leads");
  }

  async function updateStatus(ids: number[], status: LeadRow["status"]) {
    "use server";
    await requireStaff();
    if (!Array.isArray(ids) || ids.length === 0) return;
    const allowed = ["new", "follow_up", "contacted", "qualified", "converted", "lost"] as const;
    if (!(allowed as readonly string[]).includes(status)) return;
    await db.update(leads).set({ status }).where(inArray(leads.id, ids));
    revalidatePath("/admin/leads");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Leads</h1>
        <div className="flex items-center gap-4">
          <a
            href="/admin/leads/blocklist"
            className="text-sm text-(--color-cyan) hover:underline"
          >
            Blocklist / Allowlist →
          </a>
          <span className="text-sm text-white/50 font-mono">[ {list.length} total ]</span>
        </div>
      </div>
      <LeadsBulkTable
        rows={list.map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          company: l.company,
          source: l.source,
          status: l.status,
          score: l.score,
          createdAt: l.createdAt.toISOString(),
        }))}
        deleteMany={deleteMany}
        updateStatus={updateStatus}
      />
    </div>
  );
}
