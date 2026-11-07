import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { programs, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { CATEGORY_BY_SLUG, formatPrice } from "@/lib/portal-content";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "text-emerald-700" },
  full: { label: "Full", cls: "text-coral" },
  closed: { label: "Closed", cls: "text-slate-500" },
  cancelled: { label: "Cancelled", cls: "text-slate-500" },
  completed: { label: "Completed", cls: "text-slate-500" },
};

export default async function ProgramDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [program] = await db
    .select()
    .from(programs)
    .where(eq(programs.slug, slug))
    .limit(1);
  if (!program || !program.published) notFound();

  const cohorts = await db
    .select()
    .from(classes)
    .where(eq(classes.programId, program.id))
    .catch(() => []);
  const cat = CATEGORY_BY_SLUG[program.category];

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/programs" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
          ← All programs
        </Link>

        <div className={`mt-4 rounded-[2rem] bg-white p-7 shadow-sm ring-1 ${cat?.ring ?? "ring-amber-100"}`}>
          <div className={`inline-flex h-16 w-16 items-center justify-center rounded-3xl text-4xl ${cat?.accent ?? ""}`}>
            {program.emoji ?? cat?.emoji ?? "✨"}
          </div>
          <h1 className="mt-4 font-fun text-4xl font-700 text-slate-900">{program.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-fun text-slate-500">
            <span className="text-sm">Ages {program.ageMin}–{program.ageMax} · {cat?.title}</span>
            <span className="text-lg font-700 text-coral">{formatPrice(program.priceCents)}</span>
          </div>
          {program.summary && (
            <p className="mt-4 font-round text-lg text-slate-600">{program.summary}</p>
          )}
        </div>

        {/* Cohorts */}
        <h2 className="mt-6 font-fun text-2xl font-700 text-slate-900">Upcoming classes</h2>
        <div className="mt-4 space-y-3">
          {cohorts.length === 0 && (
            <div className="rounded-3xl bg-white p-6 text-slate-500 shadow-sm">
              No classes scheduled right now. Tap “Chat with us” to ask about new dates!
            </div>
          )}
          {cohorts.map((c) => {
            const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.closed;
            const seatsLeft = Math.max(0, c.maxStudents - c.seatsTaken);
            const bookable = c.status === "open" && seatsLeft > 0;
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-100 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-fun text-lg font-700 text-slate-800">{c.title}</h3>
                    <span className={`font-fun text-sm font-700 ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.schedule ?? "Schedule TBA"} · {c.mode === "onsite" ? c.location ?? "On-site" : "Online"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {seatsLeft} of {c.maxStudents} seats left · {formatPrice(c.priceCents || program.priceCents)}
                  </p>
                </div>
                {bookable ? (
                  <Link
                    href={`/book/${c.id}`}
                    className="rounded-full bg-coral px-6 py-3 text-center font-fun font-700 text-white shadow-md shadow-coral/30 transition hover:scale-105"
                  >
                    Book seat
                  </Link>
                ) : (
                  <span className="rounded-full bg-slate-100 px-6 py-3 text-center font-fun font-600 text-slate-400">
                    {c.status === "full" ? "Full" : "Unavailable"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
