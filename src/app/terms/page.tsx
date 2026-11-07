import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const PAGE_URL = "https://ai4kids.tertiarycourses.com.sg/terms";
const COMPANY = "Tertiary Infotech Academy Pte Ltd";
const BRAND = "Tertiary Infotech Academy";
const EFFECTIVE_DATE = "16 May 2026";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Tertiary Infotech Academy — covering use of our website, training services, and the publication of video content to third-party platforms including TikTok.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Terms of Service — Tertiary Infotech Academy",
    description:
      "Terms of Service governing use of the Tertiary Infotech Academy website, training services, and video content published to platforms including TikTok.",
    locale: "en_SG",
    siteName: BRAND,
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: BRAND }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Tertiary Infotech Academy",
    description:
      "Terms governing use of our website, services, and video content published to TikTok and other platforms.",
    images: ["/icon-192.png"],
  },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="relative pt-6 pb-10">

        <Container>
          <div className="max-w-3xl mx-auto">
            <div className="kicker mb-3">[ LEGAL ]</div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
              Terms of <span className="gradient-text">Service</span>
            </h1>
            <p className="text-white/60 text-sm font-mono mb-10">
              Effective date: {EFFECTIVE_DATE}
            </p>

            <div className="glass p-8 space-y-8 text-white/80 leading-relaxed">
              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  1. Introduction
                </h2>
                <p>
                  These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of
                  the website at{" "}
                  <a
                    href="https://www.tertiaryinfotech.com"
                    className="text-(--color-cyan) hover:underline"
                  >
                    www.tertiaryinfotech.com
                  </a>
                  , together with all training, consultancy, and digital content
                  services (collectively, the &ldquo;Services&rdquo;) operated by{" "}
                  {COMPANY} (&ldquo;{BRAND}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), a company
                  incorporated in Singapore. By accessing or using the Services,
                  you agree to be bound by these Terms.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  2. Eligibility
                </h2>
                <p>
                  You must be at least 18 years old, or the age of majority in
                  your jurisdiction, to use the Services. By using the Services,
                  you represent that you meet this requirement and that any
                  information you submit is accurate and current.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  3. Use of the Services
                </h2>
                <p>You agree not to:</p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>Use the Services for any unlawful or fraudulent purpose;</li>
                  <li>
                    Attempt to gain unauthorised access to any part of the
                    Services, our infrastructure, or any related systems;
                  </li>
                  <li>
                    Interfere with or disrupt the Services or servers or networks
                    connected to the Services;
                  </li>
                  <li>
                    Reproduce, duplicate, copy, sell, resell, or exploit any
                    portion of the Services without our prior written permission.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  4. Video Content Published to TikTok and Other Platforms
                </h2>
                <p>
                  {BRAND} publishes original video content — including course
                  previews, trainer introductions, training highlights, client
                  testimonials (where consent has been obtained), and educational
                  short-form content — to third-party social platforms,
                  including but not limited to TikTok, YouTube, LinkedIn, and
                  Facebook.
                </p>
                <p className="mt-3">
                  Where we use the TikTok Developer Platform (including the
                  TikTok Content Posting API or related APIs), we additionally
                  agree to comply with the{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/terms-of-service/en"
                    className="text-(--color-cyan) hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TikTok Terms of Service
                  </a>
                  , the{" "}
                  <a
                    href="https://developers.tiktok.com/doc/tiktok-api-terms-of-service"
                    className="text-(--color-cyan) hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TikTok API Terms of Service
                  </a>
                  , and the{" "}
                  <a
                    href="https://www.tiktok.com/community-guidelines/en/"
                    className="text-(--color-cyan) hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TikTok Community Guidelines
                  </a>
                  .
                </p>
                <p className="mt-3">
                  Specifically, in respect of video content posted to TikTok we
                  represent that:
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>
                    All content is owned by {BRAND} or is used with the express
                    permission of the rights-holder;
                  </li>
                  <li>
                    Content does not infringe any third-party intellectual
                    property, privacy, or publicity rights;
                  </li>
                  <li>
                    Content does not contain misleading information, hate
                    speech, harassment, sexually explicit material, violence, or
                    any other material prohibited by the TikTok Community
                    Guidelines;
                  </li>
                  <li>
                    Where individuals (trainers, learners, clients) appear in
                    the content, we have obtained their consent to be filmed
                    and to have their likeness published;
                  </li>
                  <li>
                    Sponsored, branded, or commercial content is disclosed in
                    accordance with TikTok&rsquo;s branded-content and disclosure
                    requirements.
                  </li>
                </ul>
                <p className="mt-3">
                  TikTok users who interact with our content remain subject to
                  TikTok&rsquo;s own terms and privacy policy. {BRAND} does not
                  collect or store TikTok user data beyond what is strictly
                  necessary to manage and publish our own content.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  5. Intellectual Property
                </h2>
                <p>
                  All content on the Services — including text, graphics,
                  logos, videos, course materials, and software — is the
                  property of {COMPANY} or its licensors and is protected by
                  Singapore and international copyright, trademark, and other
                  intellectual property laws. No content may be reproduced or
                  redistributed without our prior written consent.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  6. User-Submitted Content
                </h2>
                <p>
                  If you submit content to us (for example, via the contact
                  form, a course enrolment, or a testimonial), you grant {BRAND}{" "}
                  a non-exclusive, worldwide, royalty-free licence to use,
                  reproduce, and display that content for the purpose of
                  delivering and promoting the Services, including
                  re-publication on social platforms such as TikTok. You
                  represent that you have all necessary rights to grant this
                  licence.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  7. Privacy
                </h2>
                <p>
                  Our handling of personal data is described in our Privacy
                  Policy. We comply with the Singapore Personal Data Protection
                  Act 2012 (PDPA).
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  8. Disclaimers
                </h2>
                <p>
                  The Services are provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo;
                  basis. To the maximum extent permitted by law, {BRAND}{" "}
                  disclaims all warranties, express or implied, including
                  fitness for a particular purpose, merchantability, and
                  non-infringement.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  9. Limitation of Liability
                </h2>
                <p>
                  To the fullest extent permitted by law, {COMPANY} shall not be
                  liable for any indirect, incidental, special, consequential,
                  or punitive damages arising out of or relating to your use of
                  the Services.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  10. Termination
                </h2>
                <p>
                  We reserve the right to suspend or terminate your access to
                  the Services at any time, with or without notice, for any
                  breach of these Terms.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  11. Changes to These Terms
                </h2>
                <p>
                  We may revise these Terms from time to time. The current
                  version will always be posted at this URL with an updated
                  effective date. Material changes will be highlighted where
                  reasonable.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  12. Governing Law
                </h2>
                <p>
                  These Terms are governed by the laws of the Republic of
                  Singapore. Any dispute arising out of or in connection with
                  these Terms shall be subject to the exclusive jurisdiction of
                  the Singapore courts.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  13. Contact
                </h2>
                <p>
                  Questions about these Terms can be sent to{" "}
                  <a
                    href="mailto:angch@tertiaryinfotech.com"
                    className="text-(--color-cyan) hover:underline"
                  >
                    angch@tertiaryinfotech.com
                  </a>
                  , or via our{" "}
                  <a href="/contact" className="text-(--color-cyan) hover:underline">
                    contact page
                  </a>
                  .
                </p>
                <p className="mt-3 text-sm text-white/60">
                  {COMPANY} &middot; Singapore
                </p>
              </section>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
