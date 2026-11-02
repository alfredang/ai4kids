import { KidsIcon } from "@/components/public/KidsIcon";
import { FamilyBanner } from "@/components/public/FamilyBanner";
import Link from "next/link";
import type { Metadata } from "next";


import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { PipMascot } from "@/components/public/PipMascot";
import { ToyboxArt } from "@/components/public/WorkshopArt";
import {
  HolidayEnquiryForm,
  StarterPack,
  TryTogether,
  WorkshopAlbum,
} from "@/components/public/HolidayInteractive";
import { FAMILY_FAQS, workshopWhatsAppUrl } from "@/lib/holiday-workshops";
import { getWhatsAppNumber } from "@/lib/portal-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "AI for Kids Singapore | December School Holiday Workshops" },
  description:
    "AI for kids in Singapore: explore AI story writing, math, science and creative workshops together. Enquire about December school holiday workshops for kids.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Little minds. Big adventures. Together.",
    description:
      "December AI holiday workshops for Singapore parents and kids. Stories, art, maths and science, made together.",
    url: "/",
    images: [
      {
        url: "/images/family-ai-banner.webp",
        width: 3840,
        height: 2160,
        alt: "Singaporean parents and children learning AI together",
      },
    ],
    locale: "en_SG",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const TOOLS = [
  {
    name: "AutoDraw",
    emoji: "✎",
    label: "FOR LITTLE DOODLERS",
    description: "Turn your doodles into pictures.",
    href: "https://www.autodraw.com/",
    note: "Free drawing tool",
    theme: "peach",
  },
  {
    name: "Teachable Machine",
    emoji: "✿",
    label: "FOR CURIOUS EXPLORERS",
    description: "Teach AI with leaves, toys or drawings.",
    href: "https://teachablemachine.withgoogle.com/",
    note: "Free browser tool · adult-guided",
    theme: "mint",
  },
  {
    name: "Quick, Draw!",
    emoji: "〰",
    label: "FOR THE WHOLE FAMILY",
    description: "Doodle. Giggle. Can AI guess it?",
    href: "https://quickdraw.withgoogle.com/",
    note: "Free game · drawings join a public dataset",
    theme: "yellow",
  },
  {
    name: "ChatGPT",
    emoji: "✧",
    label: "FOR GROWN-UP CO-PILOTS",
    description: "Story sparks and maths clues. Grown-ups lead.",
    href: "https://chatgpt.com/",
    note: "Free tier · adult-operated for under-13s",
    theme: "lilac",
  },
];

export default async function HomePage() {
  const whatsapp = (await getWhatsAppNumber())!;
  return (
    <div className="kids-marketing">
      <SiteHeader />
      <main id="main-content">
        <section className="kids-hero kids-wrap" aria-labelledby="hero-title">
          <FamilyBanner />
          <div className="kids-photo-notes">
            <span>
              <KidsIcon name="book" /> Our very own <strong>AI storybook</strong>
            </span>
            <span>
              <KidsIcon name="maths" /> A <strong>maths mystery</strong>, solved together!
            </span>
          </div>
          <div className="kids-hero-heading">
            <h1 id="hero-title">
              <span className="kids-hero-line">AI for kids.</span>
              <span className="kids-hero-together">Big ideas, together!</span>
            </h1>
            <div className="kids-hero-intro">
              <p className="kids-season-note">December school holidays · Singapore</p>
              <p>
                Stories, art, maths and science.{" "}
                <b>Made with AI. Made together.</b>
              </p>
              <div className="kids-hero-actions">
                <a className="kids-button" href="#workshops">
                  Pick our adventure <KidsIcon name="arrow" aria-hidden="true" />
                </a>
                <a className="kids-text-link" href="#free-pack">
                  Grab a free activity <span aria-hidden="true">↗</span>
                </a>
              </div>
              <p className="kids-hero-small">
                <KidsIcon name="heart" aria-hidden="true" /> Made for Singapore
                families · Suggested ages 7–12
              </p>
            </div>
          </div>
          <div className="kids-trust-strip">
            <span>
              <KidsIcon name="heart" aria-hidden="true" /> Parent + child, side by side
            </span>
            <span>
              <KidsIcon name="sparkles" aria-hidden="true" /> Create something to keep
            </span>
            <span>
              <KidsIcon name="shield" aria-hidden="true" /> Thoughtful,
              adult-guided AI
            </span>
            <span>
              <KidsIcon name="sun" aria-hidden="true" /> Free tools. Big possibilities.
            </span>
          </div>
        </section>

        <section id="workshops" className="kids-album-section">
          <div className="kids-wrap">
            <div className="kids-section-heading">
              <div>
                <span className="kids-eyebrow">
                  The December adventure album
                </span>
                <h2>
                  December school holiday <span>workshops for kids</span>
                </h2>
              </div>
              <p>Four ways to create, explore and giggle.</p>
              <span className="kids-heading-flower" aria-hidden="true">
                ✿
              </span>
            </div>
            <WorkshopAlbum />
          </div>
        </section>

        <section id="together" className="kids-wrap kids-together-section">
          <div className="kids-together-copy">
            <h2>
              Little “what ifs”.
              <br />
              <span>Big “we did it!”</span>
            </h2>
            <p>A little AI. A lot of imagination. Try it together!</p>
            <div className="kids-family-promises">
              <p>
                <KidsIcon name="wand" /> Their ideas.
              </p>
              <p>
                <KidsIcon name="heart" /> Your time together.
              </p>
              <p>
                <KidsIcon name="rainbow" /> Something to be proud of.
              </p>
            </div>
            <a className="kids-text-link" href="#enquire">
              Find our family’s fit <KidsIcon name="arrow" aria-hidden="true" />
            </a>
          </div>
          <div className="kids-together-demo">
            <div className="kids-demo-label">
              <PipMascot />
              <span>Psst… try a tiny adventure!</span>
            </div>
            <TryTogether />
          </div>
        </section>

        <section className="kids-pack-background">
          <div className="kids-wrap">
            <StarterPack number={whatsapp} />
          </div>
        </section>

        <section id="free-tools" className="kids-wrap kids-tools-section">
          <div className="kids-centred-heading">
            <h2>
              Open our <span>AI toybox!</span>
            </h2>
            <p>Free to try. Grown-up included!</p>
          </div>
          <div className="kids-toybox-layout">
            <ToyboxArt />
            <div className="kids-tools-grid">
              {TOOLS.map((t) => (
                <a
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`kids-tool-card kids-${t.theme}`}
                  key={t.name}
                >
                  <div className="kids-tool-top">
                    <span className="kids-tool-icon" aria-hidden="true">
                      <KidsIcon name={t.name === "AutoDraw" ? "art" : t.name === "Teachable Machine" ? "science" : t.name === "Quick, Draw!" ? "wand" : "book"} />
                    </span>
                    <span aria-hidden="true">↗</span>
                  </div>

                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <span className="kids-tool-note">{t.note}</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </div>
          </div>
          <details className="kids-tools-guidance">
            <summary>A little note for grown-ups</summary>
            <p>
              Free-tier limits can change. Adults operate ChatGPT for under-13s;
              ages 13–17 need parental consent. Check each tool’s privacy
              settings.{" "}
              <a
                href="https://help.openai.com/en/articles/8313401-is-chatgpt-safe-for-all-ages"
                target="_blank"
                rel="noopener noreferrer"
              >
                Age guidance ↗
              </a>
            </p>
          </details>
        </section>

        <section className="kids-wrap kids-faq-section">
          <div>
            <span className="kids-eyebrow">FOR THE GROWN-UPS</span>
            <h2>
              Little questions.
              <br />
              <span>Helpful answers.</span>
            </h2>
            <p>There’s no such thing as a silly question.</p>
            <a
              className="kids-text-link"
              href={workshopWhatsAppUrl(whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask us on WhatsApp <KidsIcon name="arrow" aria-hidden="true" />
            </a>
          </div>
          <div className="kids-faq-list">
            {FAMILY_FAQS.map((f) => (
              <details key={f.question}>
                <summary>
                  {f.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="enquire" className="kids-enquire-background">
          <div className="kids-wrap kids-enquire-section">
            <div className="kids-enquire-copy">
              <span className="kids-season-note">A December to remember</span>
              <h2>
                Ready, set…
                <br />
                <span>let’s make memories!</span>
              </h2>
              <p>
                Ask us about December dates, fees and your child’s favourite
                adventure.
              </p>
              <a
                className="kids-button kids-button-white"
                href={workshopWhatsAppUrl(whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <KidsIcon name="chat" aria-hidden="true" /> WhatsApp +65 8866 6375
              </a>
              <span className="kids-enquire-note">
                Prefer a chat? We’re happy to help.
              </span>
              <div className="kids-enquire-mascot">
                <PipMascot />
                <span>
                  Big adventures
                  <br />
                  start small. ♡
                </span>
              </div>
            </div>
            <HolidayEnquiryForm number={whatsapp} />
          </div>
        </section>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAMILY_FAQS.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
