import { PlayfulText } from "@/components/public/PlaySymbol";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { FreeTrialForm } from "@/components/public/FreeTrialForm";

export const metadata: Metadata = {
  title: "Book a Free Trial Class | AI Kids Academy",
  description:
    "Book a free trial class for your child (ages 4–16). Storytelling, coding, game design, phonics and AI escape rooms. We reply within 1 business day.",
  alternates: { canonical: "/free-trial" },
  openGraph: {
    title: "Book a Free Trial Class | AI Kids Academy",
    description: "Try a class for free — ages 4–16. We reply within 1 business day.",
    type: "website",
  },
};

const PERKS = [
  { emoji: "🎁", title: "Completely free", body: "No card, no commitment — just a fun taster session." },
  { emoji: "👩‍🏫", title: "Live, small classes", body: "Real instructors, tiny groups, lots of attention." },
  { emoji: "⚡", title: "Quick reply", body: "We'll be in touch within 1 business day to book a time." },
];

export default function FreeTrialPage() {
  return (
    <div className="bg-cream">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-sunny/30 blur-2xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-56 w-56 rounded-full bg-sky/20 blur-2xl" />

        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          {/* Pitch */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-fun text-sm font-600 text-coral shadow-sm"><PlayfulText text={" 🎉 Free trial · Ages 4–16 "} /></span>
            <h1 className="mt-4 font-fun text-4xl font-700 leading-tight text-slate-900 md:text-5xl">
              Book your child&apos;s <span className="text-coral">free trial</span> class
            </h1>
            <p className="mt-4 max-w-md font-round text-lg text-slate-600">
              Tell us a little about your child and we&apos;ll find the perfect class to try — storytelling,
              coding, game design, phonics or an AI escape room.
            </p>
            <ul className="mt-8 space-y-4">
              {PERKS.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    <PlayfulText text={p.emoji} />
                  </span>
                  <div>
                    <div className="font-fun font-700 text-slate-800">{p.title}</div>
                    <div className="font-round text-sm text-slate-500">{p.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div className="md:pt-2">
            <FreeTrialForm />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
