import Image from "next/image";
import type { Metadata } from "next";
import { KidsIcon, type KidsIconName } from "@/components/public/KidsIcon";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { FreeTrialForm } from "@/components/public/FreeTrialForm";

export const metadata: Metadata = {
  title: "Book a Free Trial Class",
  description:
    "Book a free trial class for your child (ages 4–16). Storytelling, coding, game design, phonics and AI escape rooms. We reply within 1 business day.",
  alternates: { canonical: "/free-trial" },
  openGraph: {
    title: "Book a Free Trial Class | AI Kids Academy",
    description: "Try a class for free — ages 4–16. We reply within 1 business day.",
    type: "website",
  },
};

const PERKS: { icon: KidsIconName; title: string; body: string }[] = [
  { icon: "gift", title: "Completely free", body: "No card, no commitment — just a fun taster session." },
  { icon: "heart", title: "Live, small classes", body: "Real instructors, tiny groups, lots of attention." },
  { icon: "chat", title: "Quick reply", body: "We'll be in touch within 1 business day to book a time." },
];

export default function FreeTrialPage() {
  return (
    <div className="kids-workshop-page min-h-screen">
      <SiteHeader />

      <section>
        <div className="kids-wrap grid items-stretch gap-8 py-6 md:grid-cols-2">
          {/* Pitch */}
          <div className="kids-rise flex flex-col">
            <p className="kids-plain-label">Free trial · Ages 4–16</p>
            <h1 className="kids-catalogue-heading mt-2">
              Book your child&apos;s <span>free trial</span> class
            </h1>
            <p className="mt-3 font-round text-lg text-slate-600">
              Tell us a little about your child and we&apos;ll find the perfect class to try — storytelling,
              coding, game design, phonics or an AI escape room.
            </p>
            <ul className="mt-4 space-y-3">
              {PERKS.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    <KidsIcon name={p.icon} />
                  </span>
                  <div>
                    <div className="font-fun font-700 text-slate-800">{p.title}</div>
                    <div className="font-round text-sm text-slate-500">{p.body}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="kids-trial-photo">
              <Image
                src="/images/maths-workshop-banner.webp"
                alt="Illustration of a parent and child solving a maths puzzle together with a teacher"
                fill
                sizes="(max-width: 768px) 100vw, 620px"
              />
            </div>
          </div>

          {/* Form */}
          <div className="kids-rise" style={{ animationDelay: "120ms" }}>
            <FreeTrialForm />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
