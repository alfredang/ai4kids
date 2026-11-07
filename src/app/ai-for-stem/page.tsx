import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { KidsIcon } from "@/components/public/KidsIcon";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { WorkshopSticker } from "@/components/public/WorkshopSticker";
import { WorkshopFaqs } from "@/components/public/WorkshopFaqs";
import { HolidayEnquiryForm } from "@/components/public/HolidayInteractive";
import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";
import { getWhatsAppNumber } from "@/lib/portal-settings";
import { PUBLIC_SITE_URL } from "@/lib/public-site";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "AI for STEM in Singapore: kids aged 8–12 solve maths mysteries and train a science model with a grown-up, checking AI as they go. Ask about December dates.";

export const metadata: Metadata = {
  title: { absolute: "AI for STEM in Singapore | Maths & Science for Kids" },
  description: DESCRIPTION,
  alternates: { canonical: "/ai-for-stem" },
  openGraph: {
    title: "AI for STEM in Singapore | AI Kids Academy",
    description:
      "Hands-on maths and science workshops where kids test ideas and check AI answers.",
    url: "/ai-for-stem",
    type: "website",
    locale: "en_SG",
    images: [
      {
        url: "/images/maths-workshop-banner.webp",
        width: 3840,
        height: 2160,
        alt: "Illustration of a parent and child solving a maths mystery with AI",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

const maths = HOLIDAY_WORKSHOPS.find((w) => w.slug === "ai-maths-detectives")!;
const science = HOLIDAY_WORKSHOPS.find(
  (w) => w.slug === "ai-science-explorers",
)!;

const FAQS = [
  {
    question: "What does AI for STEM mean for kids?",
    answer:
      "It means using AI to explore science, technology, engineering and maths by asking questions, testing ideas and checking answers. Children do the reasoning, and AI gives them something to question.",
  },
  {
    question: "What age are the AI for STEM workshops for?",
    answer:
      "The suggested age range is 8–12. Tell us your child’s age and interests and our team will recommend a suitable option.",
  },
  {
    question: "Will AI just do my child’s maths for them?",
    answer:
      "No. The goal is reasoning, not copying answers. Children ask for one hint at a time, draw their own bar model and check the arithmetic themselves.",
  },
  {
    question: "Does my child need to know how to code?",
    answer:
      "No. No prior AI or coding experience is needed. The science activity uses Google Teachable Machine in a browser, with a grown-up guiding the experiment.",
  },
  {
    question: "When and where are the workshops?",
    answer:
      "Ask about the December 2026 holiday workshops. Our team will confirm dates, session length, venue or online format and fees before you book.",
  },
] as const;

export default async function AiForStemPage() {
  const number = (await getWhatsAppNumber())!;
  return (
    <div className="kids-workshop-page">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-workshop-main">
        <Link className="kids-breadcrumb" href="/holiday-workshops">
          ← All AI kids workshops
        </Link>
        <section className="kids-workshop-banner kids-mint">
          <div>
            <span className="kids-season-note">
              December 2026 · Singapore · Ages 8–12
            </span>
            <h1>AI for STEM in Singapore</h1>
            <p>
              <strong>Hands-on maths and science workshops for kids.</strong>
            </p>
            <p>
              Children use AI to ask better questions, test ideas and check
              answers, instead of copying them.
            </p>
            <a href="#enquire" className="kids-button">
              Ask about December dates <KidsIcon name="arrow" aria-hidden="true" />
            </a>
          </div>
          <span className="kids-workshop-emoji" aria-hidden="true">
            <WorkshopSticker subject="Science" />
          </span>
        </section>

        <section className="kids-workshop-description">
          <aside>
            <h2>
              <Link href={`/holiday-workshops/${maths.slug}`}>
                AI for maths: {maths.title}
              </Link>
            </h2>
            <p>{maths.summary}</p>
            <ol>
              {maths.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p>
              <b>To keep:</b> {maths.takeaway}. {maths.parentNote}
            </p>
          </aside>
          <aside>
            <h2>
              <Link href={`/holiday-workshops/${science.slug}`}>
                AI for science: {science.title}
              </Link>
            </h2>
            <p>{science.summary}</p>
            <ol>
              {science.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p>
              <b>To keep:</b> {science.takeaway}. {science.parentNote}
            </p>
          </aside>
        </section>

        <section className="kids-workshop-description">
          <div>
            <h2>What your child practises in each part of STEM</h2>
            <p>
              <strong>Science:</strong> observing leaves and flowers, grouping
              what they can see and testing a prediction.
            </p>
            <p>
              <strong>Technology:</strong> training a simple image model and
              discovering what it did and did not learn.
            </p>
            <p>
              <strong>Engineering thinking:</strong> trying new examples,
              spotting where the model goes wrong and explaining why.
            </p>
            <p>
              <strong>Maths:</strong> turning familiar Singapore situations
              into word problems, drawing bar models and checking the
              arithmetic.
            </p>
            <p>
              AI is part of learning in Singapore classrooms too: see the{" "}
              <a
                href="https://www.moe.gov.sg/education-in-sg/educational-technology-journey/edtech-masterplan/artificial-intelligence-in-education"
                target="_blank"
                rel="noopener noreferrer"
                title="Ministry of Education: artificial intelligence in education"
              >
                Ministry of Education’s page on AI in education
              </a>
              .
            </p>
          </div>
          <aside>
            <h3>Try a STEM activity at home</h3>
            <p>
              <b>Maths:</b> At the hawker centre, Mei buys 3 bowls of noodles
              for S$4 each and pays with S$20. Ask AI: “Give us one helpful
              hint. Don’t tell us the answer yet.” Then draw it and check it.
            </p>
            <p>
              <b>Science:</b> Open{" "}
              <a
                href="https://teachablemachine.withgoogle.com/"
                target="_blank"
                rel="noopener noreferrer"
                title="Google Teachable Machine, a free browser tool"
              >
                Google Teachable Machine
              </a>{" "}
              with a grown-up and teach it to tell two kinds of leaf apart. Use
              objects or drawings, not faces.
            </p>
            <p>
              More ideas are in our{" "}
              <a href="/downloads/family-ai-starter-pack.html">
                free family activity pack
              </a>
              , and our <Link href="/games">AI games for kids</Link> include
              code puzzles.
            </p>
            <h3>Other AI workshops</h3>
            <p>
              Prefer words to numbers? Try{" "}
              <Link href="/holiday-workshops/creative-story-writing">
                creative writing with AI
              </Link>
              , or see every{" "}
              <Link href="/holiday-workshops">
                school holiday AI programme
              </Link>
              .
            </p>
          </aside>
        </section>

        <WorkshopFaqs
          heading="AI for STEM: your questions"
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
                src="/images/maths-workshop-banner.webp"
                alt="Illustration of a parent and child solving a maths mystery together at a workshop"
                fill
                sizes="(max-width: 900px) 100vw, 480px"
              />
            </div>
          </div>
          <HolidayEnquiryForm number={number} source="ai-for-stem" />
        </section>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "AI for STEM workshops for kids",
            serviceType: "AI for STEM workshops for children",
            description: DESCRIPTION,
            url: `${PUBLIC_SITE_URL}/ai-for-stem`,
            areaServed: { "@type": "Country", name: "Singapore" },
            provider: {
              "@type": "Organization",
              name: "Tertiary Infotech Academy Pte Ltd",
              url: PUBLIC_SITE_URL,
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
