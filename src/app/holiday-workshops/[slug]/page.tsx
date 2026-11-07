import { WORKSHOP_SEO, PUBLIC_SITE_URL } from "@/lib/public-site";
import { WorkshopSticker } from "@/components/public/WorkshopSticker";
import { KidsIcon } from "@/components/public/KidsIcon";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { HolidayEnquiryForm } from "@/components/public/HolidayInteractive";
import { WorkshopFaqs } from "@/components/public/WorkshopFaqs";
import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";
import { getWhatsAppNumber } from "@/lib/portal-settings";

export const dynamic = "force-dynamic";

// Generated workshop scenes that fill each page's shorter columns.
const WORKSHOP_SCENE: Record<string, string> = {
  "creative-story-writing": "story-workshop-banner",
  "creative-content-studio": "story-workshop-banner",
  "ai-maths-detectives": "maths-workshop-banner",
  "ai-science-explorers": "maths-workshop-banner",
};
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
    title: {
      absolute: `${WORKSHOP_SEO[slug].metaTitle ?? `${WORKSHOP_SEO[slug].title} Singapore`} | AI Kids`,
    },
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
  const seo = WORKSHOP_SEO[slug];
  return (
    <div className="kids-workshop-page">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-workshop-main">
        <Link className="kids-breadcrumb" href="/holiday-workshops">
          ← All AI kids workshops
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
            <div className="kids-workshop-scene">
              <Image
                src={`/images/${WORKSHOP_SCENE[slug] ?? "family-ai-banner"}.webp`}
                alt="Illustration of a parent and child working together at a family workshop"
                fill
                sizes="(max-width: 900px) 100vw, 660px"
              />
            </div>
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
            <h3>More AI workshops</h3>
            <p>
              See all our{" "}
              <Link href="/holiday-workshops">
                AI kids workshops in Singapore
              </Link>
              {workshop.subject === "Maths" || workshop.subject === "Science" ? (
                <>
                  , or how they fit together in{" "}
                  <Link href="/ai-for-stem">AI for STEM</Link>
                </>
              ) : null}
              .
            </p>
          </aside>
        </section>
        {seo.guide && (
          <section className="kids-workshop-description">
            <div>
              <h2>{seo.guide.heading}</h2>
              {seo.guide.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <aside>
              <h3>Keep the story going</h3>
              <p>
                Try our free{" "}
                <a href="/downloads/family-ai-starter-pack.html">
                  family activity pack
                </a>{" "}
                at home, play the story adventures in our{" "}
                <Link href="/games">AI games for kids</Link>, or browse{" "}
                <Link href="/programs?category=storytelling">
                  AI storytelling programmes
                </Link>
                .
              </p>
              <p>
                Prefer numbers to words? Explore{" "}
                <Link href="/ai-for-stem">AI for STEM in Singapore</Link>.
              </p>
              <h3>Try a story spark at home</h3>
              <p>
                With a grown-up at the keyboard, ask: “Help us imagine a story
                about a tiny Merlion who finds a rainbow in a kaya toast shop.
                Give us three possible adventures!” Then let your child pick
                one and change the ending.
              </p>
            </aside>
          </section>
        )}
        {seo.faqs && (
          <WorkshopFaqs
            heading="Creative writing with AI: your questions"
            intro="There’s no such thing as a silly question."
            faqs={seo.faqs}
          />
        )}
        <section id="workshop-enquiry" className="kids-workshop-enquire">
          <div>
            <span className="kids-eyebrow">LET’S MAKE A HOLIDAY MEMORY</span>
            <h2>
              A little hello.
              <br />A big adventure.
            </h2>
            <p>
              Interested in “{workshop.shortTitle}”? Ask for the December
              details. No payment or reservation is made by this enquiry.
            </p>
            <a
              className="kids-button kids-button-white"
              href={workshopWhatsAppUrl(number, workshop.shortTitle)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <KidsIcon name="chat" aria-hidden="true" /> Ask our team on WhatsApp
            </a>
            <div className="kids-workshop-scene">
              <Image
                src="/images/family-ai-banner.webp"
                alt="Illustration of two Singapore families exploring AI together on a laptop and tablet"
                fill
                sizes="(max-width: 900px) 100vw, 480px"
              />
            </div>
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
