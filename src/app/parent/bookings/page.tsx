import { PlayfulText } from "@/components/public/PlaySymbol";
import { db } from "@/db";
import { bookings, classes, programs, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPayNowConfig } from "@/lib/portal-settings";
import { generatePayNowQrDataUrl } from "@/lib/paynow";
import { formatPrice } from "@/lib/portal-content";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Awaiting confirmation", cls: "bg-amber-100 text-amber-700" },
  awaiting_payment: { label: "Pay now (PayNow)", cls: "bg-sky/20 text-sky-700" },
  confirmed: { label: "Confirmed", cls: "bg-mint/20 text-emerald-700" },
  paid: { label: "Paid ✓", cls: "bg-mint/30 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-200 text-slate-500" },
};

export default async function ParentBookings({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const { booked } = await searchParams;
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent/bookings");
  const parentId = Number(session.id);

  const rows = await db
    .select({
      booking: bookings,
      className: classes.title,
      schedule: classes.schedule,
      programTitle: programs.title,
      learnerName: users.name,
    })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .innerJoin(programs, eq(classes.programId, programs.id))
    .innerJoin(users, eq(bookings.learnerId, users.id))
    .where(eq(bookings.parentId, parentId))
    .orderBy(desc(bookings.createdAt));

  const paynow = await getPayNowConfig();

  // Pre-generate QR data-URIs for awaiting_payment bookings.
  const qrs = new Map<number, string>();
  if (paynow) {
    for (const r of rows) {
      if (r.booking.status === "awaiting_payment" && r.booking.amountCents > 0) {
        qrs.set(
          r.booking.id,
          await generatePayNowQrDataUrl({
            uen: paynow.uen,
            amountCents: r.booking.amountCents,
            reference: r.booking.paymentRef,
            merchantName: paynow.payeeName,
          }),
        );
      }
    }
  }

  return (
    <div>
      <h1 className="font-fun text-3xl font-700 text-slate-900">My bookings</h1>
      {booked && (
        <div className="mt-4 rounded-2xl bg-mint/20 p-4 font-round text-emerald-700"><PlayfulText text={" 🎉 Booking requested! We'll confirm the class and email your PayNow QR shortly. "} /></div>
      )}

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">
            No bookings yet. <a href="/programs" className="text-coral underline">Browse programs →</a>
          </p>
        )}
        {rows.map((r) => {
          const st = STATUS[r.booking.status] ?? STATUS.pending;
          const qr = qrs.get(r.booking.id);
          return (
            <div key={r.booking.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-fun text-lg font-700 text-slate-800">{r.className}</div>
                  <div className="text-sm text-slate-500">{r.programTitle} · for {r.learnerName}</div>
                  <div className="text-sm text-slate-400">{r.schedule ?? "Schedule TBA"}</div>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-3 py-1 text-xs font-600 ${st.cls}`}>{st.label}</span>
                  <div className="mt-1 font-fun font-700 text-coral">{formatPrice(r.booking.amountCents)}</div>
                </div>
              </div>
              {qr && (
                <div className="mt-4 flex flex-col items-center rounded-2xl bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <img src={qr} alt="PayNow QR" width={160} height={160} className="rounded-xl bg-white p-1" />
                  <div className="mt-3 sm:mt-0">
                    <div className="font-fun font-700 text-slate-700">Scan to pay with PayNow</div>
                    <div className="text-sm text-slate-500">Pay {formatPrice(r.booking.amountCents)} to {paynow?.payeeName}</div>
                    <div className="text-sm text-slate-500">Reference: <span className="font-mono">{r.booking.paymentRef}</span></div>
                    <div className="mt-1 text-xs text-slate-400">Your seat is secured once we receive payment.</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
