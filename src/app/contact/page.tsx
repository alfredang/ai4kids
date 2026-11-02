import { KidsIcon } from "@/components/public/KidsIcon";
import type { Metadata } from "next";


import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { PipMascot } from "@/components/public/PipMascot";
import { HolidayEnquiryForm } from "@/components/public/HolidayInteractive";
import { getCompanyContact } from "@/lib/site-settings";
import { getWhatsAppNumber } from "@/lib/portal-settings";
import { workshopWhatsAppUrl } from "@/lib/holiday-workshops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Say hello — December family workshops",
  description:
    "Ask AI Kids Academy about December parent-child AI workshops in Singapore. Stories, art, maths and science. Get dates and details for your family.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Say hello to your next family adventure | AI Kids",
    description:
      "December parent-child AI workshops in Singapore. Ask our friendly team about dates and fees.",
    url: "/contact",
    locale: "en_SG",
    type: "website",
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

export default async function ContactPage() {
  const [contact, number] = await Promise.all([
    getCompanyContact(),
    getWhatsAppNumber(),
  ]);
  return (
    <div className="kids-workshop-page">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-contact-main">
        <div className="kids-contact-intro">
          <span className="kids-season-note">Big adventures start small.</span>
          <h1>
            A little hello.
            <br />
            <span>A big December adventure!</span>
          </h1>
          <p>
            Ask about stories, art, maths or science. We’ll help you find your
            family’s fit.
          </p>
          <a
            className="kids-button"
            href={workshopWhatsAppUrl(number!)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <KidsIcon name="chat" aria-hidden="true" /> Chat on WhatsApp
          </a>
          <div className="kids-contact-details">
            <a href={`mailto:${contact.supportEmail}`}>
              <KidsIcon name="mail" aria-hidden="true" />
              <span>{contact.supportEmail}</span>
            </a>
            <a href={`tel:${contact.tel}`}>
              <KidsIcon name="phone" aria-hidden="true" />
              <span>{contact.tel}</span>
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <KidsIcon name="pin" aria-hidden="true" />
              <span>{contact.address}</span>
            </a>
          </div>
          <div className="kids-enquire-mascot">
            <PipMascot />
            <span>We’re all ears! ♡</span>
          </div>
        </div>
        <HolidayEnquiryForm number={number!} />
      </main>
      <SiteFooter />
    </div>
  );
}
