import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, classes, programs, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { confirmBooking, markBookingPaid, cancelBooking } from "@/lib/booking";
import { formatPrice } from "@/lib/portal-content";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const rows = await db
    .select({
      b: bookings,
      className: classes.title,
      programTitle: programs.title,
      learner: users.name,
    })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .innerJoin(programs, eq(classes.programId, programs.id))
    .innerJoin(users, eq(bookings.learnerId, users.id))
    .orderBy(desc(bookings.createdAt));

  // Parent emails (separate join to avoid alias clash).
  const parentRows = await db
    .select({ id: bookings.id, parentEmail: users.email, parentName: users.name })
    .from(bookings)
    .innerJoin(users, eq(bookings.parentId, users.id));
  const parentById = new Map(parentRows.map((p) => [p.id, p]));

  async function doConfirm(formData: FormData) {
    "use server";
    await requireStaff();
    await confirmBooking(Number(formData.get("id")));
    revalidatePath("/admin/bookings");
  }
  async function doPaid(formData: FormData) {
    "use server";
    await requireStaff();
    await markBookingPaid(Number(formData.get("id")));
    revalidatePath("/admin/bookings");
  }
  async function doCancel(formData: FormData) {
    "use server";
    await requireStaff();
    await cancelBooking(Number(formData.get("id")));
    revalidatePath("/admin/bookings");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Bookings</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Confirm a booking to email the parent a PayNow QR. Classes auto-close when they fill up.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Kid</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Parent</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--color-muted)]">No bookings yet.</td></tr>
            ) : rows.map(({ b, className, programTitle, learner }) => {
              const parent = parentById.get(b.id);
              return (
                <tr key={b.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{b.paymentRef}</td>
                  <td className="px-3 py-2">{learner}</td>
                  <td className="px-3 py-2">{className}<div className="text-xs text-[var(--color-muted)]">{programTitle}</div></td>
                  <td className="px-3 py-2 text-xs text-[var(--color-muted)]">{parent?.parentEmail ?? parent?.parentName}</td>
                  <td className="px-3 py-2">{formatPrice(b.amountCents)}</td>
                  <td className="px-3 py-2">{b.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {(b.status === "pending") && (
                        <form action={doConfirm}><input type="hidden" name="id" value={b.id} />
                          <button className="ti-btn-ghost text-xs">Confirm + send QR</button>
                        </form>
                      )}
                      {(b.status === "awaiting_payment" || b.status === "confirmed") && (
                        <form action={doPaid}><input type="hidden" name="id" value={b.id} />
                          <button className="ti-btn-ghost text-xs">Mark paid</button>
                        </form>
                      )}
                      {b.status === "awaiting_payment" && (
                        <form action={doConfirm}><input type="hidden" name="id" value={b.id} />
                          <button className="text-xs text-cyan hover:underline">Resend QR</button>
                        </form>
                      )}
                      {b.status !== "cancelled" && (
                        <form action={doCancel}><input type="hidden" name="id" value={b.id} />
                          <button className="text-xs text-coral hover:underline">Cancel</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
