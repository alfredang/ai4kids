import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { KidsIcon } from "@/components/public/KidsIcon";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { WorkshopSticker } from "@/components/public/WorkshopSticker";
import { WorkshopFaqs } from "@/components/public/WorkshopFaqs";
import {
  HolidayEnquiryForm,
  WorkshopAlbum,
} from "@/components/public/HolidayInteractive";
import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";
import { getWhatsAppNumber } from "@/lib/portal-settings";
import { PUBLIC_SITE_URL } from "@/lib/public-site";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "AI kids workshops in Singapore for the school holidays: creative writing, storytelling, maths and science for ages 7–12. Ask about December dates and fees.";

export const metadata: Metadata = {
  title: {
    absolute: "AI Kids Workshops in Singapore | School Holiday Programmes",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/holiday-workshops" },
  openGraph: {
    title: "AI kids workshops in Singapore | AI Kids Academy",
    description:
      "School holiday AI programmes for kids: stories, art, maths and science, made together.",
    url: "/holiday-workshops",
    type: "website",
    locale: "en_SG",
    images: [
      {
        url: "/images/family-ai-banner.webp",
        width: 3840,
        height: 2160,
        alt: "Illustration of Singapore families exploring AI together",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

const FAQS = [
  {
    question: "What ages are these AI workshops for?",
    answer:
      "The suggested age range is 7–12: ages 7–12 for story writing and art, and ages 8–12 for maths and science. If your child is 4–6 or 13–16, ask us about suitability.",
  },
  {
    question: "When are the school holiday AI programmes?",
    answer:
      "Our workshops run in the December 2026 school holidays. Our team will confirm dates, session length and venue or online format before you book. Sending an enquiry does not reserve or purchase a place.",
  },
  {
    question: "Do I stay with my child during the workshop?",
    answer:
      "These workshops are designed around a parent and child learning side by side. Tell us your child’s age and interests and our team will confirm the attendance format.",
  },
  {
    question: "How much do the workshops cost?",
    answer:
      "Our team will confirm fees when you enquire. The activities use free tools or free tiers, so no paid AI subscription is needed for the proposed activities.",
  },
  {
    question: "Does my child need to know coding or AI?",
    answer:
      "No prior AI or coding experience is needed. Children bring their imagination, and adults help with reading, prompts and checking the results.",
  },
  {
    question: "How do you keep AI safe for kids?",
    answer:
      "An adult operates tools that require one, including ChatGPT for under-13s. We practise keeping personal information private, checking AI answers and using objects or drawings instead of photos of faces.",
  },
] as const;

export default async function HolidayWorkshopsPage() {
  const number = (await getWhatsAppNumber())!;
  return (
    <div className="kids-workshop-page">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-workshop-main">
        <section className="kids-workshop-banner kids-peach">
          <div>
            <span className="kids-season-note">
              December 2026 · Singapore · Ages 7–12
            </span>
            <h1>AI kids workshops in Singapore</h1>
            <p>
              <strong>School holiday AI programmes for kids</strong> and the
              grown-ups who love them.
            </p>
            <p>
              Write a story, make a comic, crack a maths mystery or train a
              science model. Your child brings the ideas.
            </p>
            <a href="#enquire" className="kids-button">
              Ask about December dates <KidsIcon name="arrow" aria-hidden="true" />
            </a>
          </div>
          <span className="kids-workshop-emoji" aria-hidden="true">
            <WorkshopSticker subject="Storytelling" />
          </span>
        </section>

        <section className="kids-album-section">
          <div className="kids-section-heading">
            <div>
              <span className="kids-eyebrow">Four December adventures</span>
              <h2>
                School holiday AI <br />
                <span>programmes for kids</span>
              </h2>
            </div>
            <p>
              Singapore’s year-end school holidays run from 21 November to 31
              December 2026 (
              <a
                href="https://www.moe.gov.sg/news/press-releases/20250730-school-terms-and-holidays-for-2026"
                target="_blank"
                rel="noopener noreferrer"
                title="Ministry of Education: school terms and holidays for 2026"
              >
                MOE calendar
              </a>
              ). Pick a December workshop by what your child already loves.
            </p>
          </div>
          <WorkshopAlbum />
        </section>

        <section className="kids-workshop-description">
          <div>
            <h2>What happens in an AI kids workshop</h2>
            <ol>
              <li>
                Start with your child’s own idea: a hero, a cause they care
                about, a word problem or a leaf.
              </li>
              <li>
                Try free AI tools together. A grown-up operates anything
                age-restricted, such as ChatGPT for under-13s.
              </li>
              <li>
                Question what comes back. Children choose, rewrite and check, so
                the thinking stays theirs.
              </li>
              <li>
                Finish with something to keep: a storybook, a poster and mini
                comic, a detective journal or a first AI experiment.
              </li>
            </ol>
            <div className="kids-workshop-scene">
              <Image
                src="/images/story-workshop-banner.webp"
                alt="Illustration of a parent and child making a storybook at an AI workshop"
                fill
                sizes="(max-width: 900px) 100vw, 660px"
              />
            </div>
          </div>
          <aside>
            <h3>Know what they’d love?</h3>
            <p>
              <Link href="/holiday-workshops/creative-story-writing">
                Creative writing and storytelling with AI
              </Link>{" "}
              for young authors.
            </p>
            <p>
              <Link href="/ai-for-stem">AI for STEM in Singapore</Link> for
              maths and science explorers.
            </p>
            <p>
              <Link href="/holiday-workshops/creative-content-studio">
                A creative AI workshop
              </Link>{" "}
              for artists and comic makers.
            </p>
            <h3>Looking beyond the holidays?</h3>
            <p>
              See our <Link href="/programs">AI programmes for kids</Link>, or
              try the <Link href="/games">AI games</Link> and a{" "}
              <a href="/downloads/family-ai-starter-pack.html">
                free family activity pack
              </a>{" "}
              at home.
            </p>
            <h3>Before you book</h3>
            <p>
              Our team will confirm dates, length, location or online format,
              fees and any tool requirements. Not sure which one suits? Tell us
              your child’s age and interests and we’ll recommend one.
            </p>
          </aside>
        </section>

        <WorkshopFaqs
          heading="AI workshops for kids: your questions"
          intro="There’s no such thing as a silly question."
          faqs={FAQS}
        />

        <section id="enquire" className="kids-workshop-enquire">
          <div>
            <span className="kids-eyebrow">LET’S MAKE A HOLIDAY MEMORY</span>
            <h2>
              A little hello.
              <br />A big adventure.
            </h2>
            <p>
              Ask for the December details. No payment or reservation is made
              by this enquiry.
            </p>
            <a
              className="kids-button kids-button-white"
              href={workshopWhatsAppUrl(number)}
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
          <HolidayEnquiryForm number={number} source="holiday-workshops" />
        </section>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "AI kids workshops in Singapore",
            description: DESCRIPTION,
            itemListElement: HOLIDAY_WORKSHOPS.map((w, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: w.shortTitle,
              url: `${PUBLIC_SITE_URL}/holiday-workshops/${w.slug}`,
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
