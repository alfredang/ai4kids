import { WORKSHOP_SEO, PUBLIC_SITE_URL } from "@/lib/public-site";
import { WorkshopSticker } from "@/components/public/WorkshopSticker";
import { KidsIcon } from "@/components/public/KidsIcon";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { HolidayEnquiryForm } from "@/components/public/HolidayInteractive";
import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";
import { getWhatsAppNumber } from "@/lib/portal-settings";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workshop = HOLIDAY_WORKSHOPS.find((w) => w.slug === slug);
  if (!workshop)
    return { title: "Workshop not found", robots: { index: false } };
  return {
    title: { absolute: `${WORKSHOP_SEO[slug].title} Singapore | AI Kids` },
    description: WORKSHOP_SEO[slug].description,
    alternates: { canonical: `/holiday-workshops/${slug}` },
    openGraph: {
      title: `${workshop.shortTitle} | AI Kids`,
      description: workshop.summary,
      type: "website",
      locale: "en_SG",
      url: `/holiday-workshops/${slug}`,
      images: [
        {
          url: "/images/family-ai-banner.webp",
          width: 3840,
          height: 2160,
          alt: "Singapore parents and kids learning AI together",
        },
      ],
    },
    twitter: { card: "summary_large_image" },
  };
}
export default async function HolidayWorkshop({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workshop = HOLIDAY_WORKSHOPS.find((w) => w.slug === slug);
  if (!workshop) notFound();
  const number = (await getWhatsAppNumber())!;
  return (
    <div className="kids-workshop-page">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-workshop-main">
        <Link className="kids-breadcrumb" href="/#workshops">
          ← Back to the adventure album
        </Link>
        <section className={`kids-workshop-banner kids-${workshop.theme}`}>
          <div>
            <span className="kids-season-note">
              December 2026 · Parent + child · Ages {workshop.ageMin}–
              {workshop.ageMax}
            </span>
            <h1>{WORKSHOP_SEO[slug].title}</h1>
            <p><strong>{workshop.title}</strong> · A Singapore parent &amp; child adventure</p>
            <p>{workshop.summary}</p>
            <a href="#workshop-enquiry" className="kids-button">
              Ask about this December workshop <span aria-hidden="true">↗</span>
            </a>
          </div>
          <span className="kids-workshop-emoji" aria-hidden="true">
            <WorkshopSticker subject={workshop.subject} />
          </span>
        </section>
        <section className="kids-workshop-description">
          <div>
            <span className="kids-eyebrow">A LITTLE PEEK INSIDE</span>
            <h2>{workshop.shortTitle}</h2>
            <ol>
              {workshop.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <aside>
            <h3>Something to be proud of</h3>
            <p>{workshop.takeaway}.</p>
            <h3>Your family’s toolbox</h3>
            <p>
              {workshop.tool}. Proposed activities use free tools or free tiers.
            </p>
            <h3>A note for grown-ups</h3>
            <p>{workshop.parentNote}</p>
            <p>
              <b>Before you book:</b> our team will confirm dates, length,
              location or online format, fees, attendance arrangements and any
              tool requirements.
            </p>
          </aside>
        </section>
        <section id="workshop-enquiry" className="kids-workshop-enquire">
          <div>
            <span className="kids-eyebrow">LET’S MAKE A HOLIDAY MEMORY</span>
            <h2>
              A little hello.
              <br />A big adventure.
            </h2>
            <p>
              Interested in {workshop.shortTitle.toLowerCase()}? Ask for the
              December details. No payment or reservation is made by this
              enquiry.
            </p>
            <a
              className="kids-button kids-button-white"
              href={workshopWhatsAppUrl(number, workshop.shortTitle)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <KidsIcon name="chat" aria-hidden="true" /> Ask our team on WhatsApp
            </a>
          </div>
          <HolidayEnquiryForm
            number={number}
            initialWorkshop={workshop.shortTitle}
          />
        </section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Course",
              name: WORKSHOP_SEO[slug].title,
              description: WORKSHOP_SEO[slug].description,
              url: `${PUBLIC_SITE_URL}/holiday-workshops/${slug}`,
              inLanguage: "en-SG",
              provider: {
                "@type": "Organization",
                name: "Tertiary Infotech Academy Pte Ltd",
              },
              educationalLevel: `Ages ${workshop.ageMin}–${workshop.ageMax}`,
              teaches: workshop.takeaway,
            }).replace(/</g, "\\u003c"),
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
