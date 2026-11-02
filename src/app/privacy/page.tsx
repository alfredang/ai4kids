import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const PAGE_URL = "https://ai4kids.tertiarycourses.com.sg/privacy";
const COMPANY = "Tertiary Infotech Academy Pte Ltd";
const BRAND = "Tertiary Infotech Academy";
const EFFECTIVE_DATE = "16 May 2026";
const CONTACT_EMAIL = "angch@tertiaryinfotech.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Tertiary Infotech Academy — how we collect, use, disclose, and protect personal data under the Singapore Personal Data Protection Act (PDPA), including data handled when publishing video content to TikTok and other platforms.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Privacy Policy — Tertiary Infotech Academy",
    description:
      "How Tertiary Infotech Academy collects, uses, and protects personal data under Singapore PDPA, including data related to TikTok content publishing.",
    locale: "en_SG",
    siteName: BRAND,
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: BRAND }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — Tertiary Infotech Academy",
    description:
      "How we collect, use, and protect personal data under Singapore PDPA.",
    images: ["/icon-192.png"],
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pt-32 pb-24">
        <div className="grid-bg opacity-40" />
        <div
          className="glow-blob"
          style={{
            top: "-10%",
            left: "10%",
            width: 480,
            height: 480,
            background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)",
          }}
        />
        <div
          className="glow-blob"
          style={{
            bottom: "-15%",
            right: "5%",
            width: 420,
            height: 420,
            background: "radial-gradient(circle, #59EBFD 0%, transparent 70%)",
          }}
        />

        <Container>
          <div className="max-w-3xl mx-auto">
            <div className="kicker mb-3">[ LEGAL ]</div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
              Privacy <span className="gradient-text">Policy</span>
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
                  {COMPANY} (&ldquo;{BRAND}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to
                  protecting the privacy of visitors to{" "}
                  <a
                    href="https://www.tertiaryinfotech.com"
                    className="text-(--color-cyan) hover:underline"
                  >
                    www.tertiaryinfotech.com
                  </a>{" "}
                  and users of our training and consultancy services. This
                  Privacy Policy explains what personal data we collect, why we
                  collect it, how we use and disclose it, and the rights you
                  have over it. We comply with the Singapore Personal Data
                  Protection Act 2012 (&ldquo;PDPA&rdquo;).
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  2. Personal Data We Collect
                </h2>
                <p>We may collect the following categories of personal data:</p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>
                    <strong className="text-white">Contact details</strong> —
                    name, email, phone number, company name, and message
                    content submitted via our contact and consultation forms.
                  </li>
                  <li>
                    <strong className="text-white">Account data</strong> — for
                    admin users, email address and securely hashed password.
                  </li>
                  <li>
                    <strong className="text-white">Course / training data</strong>{" "}
                    — name, NRIC/FIN (where required for SSG-funded courses),
                    employer details, and course progress.
                  </li>
                  <li>
                    <strong className="text-white">Media and likeness</strong> —
                    photographs and video recordings of trainers, learners,
                    and clients who have consented to appear in our marketing
                    or training content.
                  </li>
                  <li>
                    <strong className="text-white">Technical data</strong> — IP
                    address, browser type, device information, pages visited,
                    and approximate location derived from IP. Collected via
                    standard server logs and cookies.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  3. How We Use Personal Data
                </h2>
                <p>We use personal data to:</p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>Respond to enquiries and provide quotations;</li>
                  <li>
                    Deliver training, consultancy, and digital services you have
                    requested;
                  </li>
                  <li>
                    Process course enrolments, including submissions to SSG /
                    SkillsFuture Singapore where applicable;
                  </li>
                  <li>
                    Send service-related communications and, with consent,
                    marketing about new courses or services;
                  </li>
                  <li>Improve our website, content, and services;</li>
                  <li>
                    Detect, prevent, and address fraud, abuse, security, or
                    technical issues;
                  </li>
                  <li>Comply with legal and regulatory obligations.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  4. Legal Bases (PDPA)
                </h2>
                <p>
                  Under the PDPA we process personal data on the basis of your
                  consent (express or deemed), legitimate interests (e.g.
                  responding to your enquiry), or as permitted or required by
                  law (e.g. SSG funding administration, tax records).
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  5. Cookies and Analytics
                </h2>
                <p>
                  We use a small number of strictly necessary cookies to
                  authenticate admin sessions and maintain site preferences. We
                  may also use privacy-respecting analytics to understand
                  aggregate site usage. You can disable cookies in your
                  browser, though some site features may not work correctly as
                  a result.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  6. Video Content and TikTok
                </h2>
                <p>
                  {BRAND} publishes original video content — course previews,
                  trainer introductions, training highlights, testimonials
                  (where consent has been obtained), and educational shorts —
                  to social platforms including TikTok, YouTube, LinkedIn, and
                  Facebook.
                </p>
                <p className="mt-3">
                  Where we use the TikTok Developer Platform (including the
                  TikTok Content Posting API), the only data exchanged with
                  TikTok is what is required to authenticate our own publishing
                  account and to upload our own content. Specifically:
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>
                    We do <strong className="text-white">not</strong> collect or
                    store personal data of TikTok end-users (viewers, followers,
                    commenters).
                  </li>
                  <li>
                    We do <strong className="text-white">not</strong> use TikTok
                    data for profiling, advertising targeting outside TikTok&rsquo;s
                    own platform, or onward sale.
                  </li>
                  <li>
                    OAuth access tokens issued by TikTok are stored encrypted
                    at rest, used solely to publish our own content, and
                    revoked when no longer needed.
                  </li>
                  <li>
                    Individuals appearing in our TikTok video content have
                    consented to be recorded and have their likeness published.
                    You may withdraw consent at any time by contacting us at{" "}
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-(--color-cyan) hover:underline"
                    >
                      {CONTACT_EMAIL}
                    </a>
                    ; we will remove the content within a reasonable period.
                  </li>
                </ul>
                <p className="mt-3">
                  Your interactions on TikTok itself (views, likes, comments,
                  follows) are governed by{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/privacy-policy/en"
                    className="text-(--color-cyan) hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TikTok&rsquo;s Privacy Policy
                  </a>
                  , not this one.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  7. Disclosure to Third Parties
                </h2>
                <p>
                  We do not sell personal data. We may disclose personal data
                  to:
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>
                    Government agencies where required by law (e.g. SSG /
                    SkillsFuture Singapore for funded courses);
                  </li>
                  <li>
                    Service providers who process data on our behalf — including
                    hosting (Coolify / our infrastructure provider), email
                    delivery (Google Workspace / Gmail), and AI processing
                    (Anthropic, via the Claude Agent SDK using our
                    subscription) — under appropriate confidentiality
                    obligations;
                  </li>
                  <li>
                    Professional advisers (lawyers, auditors) where reasonably
                    necessary;
                  </li>
                  <li>
                    Acquirers in the event of a merger, acquisition, or sale of
                    business assets.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  8. International Transfers
                </h2>
                <p>
                  Some of our service providers process data outside Singapore.
                  Where this happens, we take reasonable steps to ensure the
                  recipient provides a standard of protection comparable to the
                  PDPA, including contractual safeguards.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  9. Data Retention
                </h2>
                <p>
                  We retain personal data only for as long as necessary to
                  fulfil the purposes for which it was collected, or as
                  required by law (e.g. accounting and SSG record-retention
                  rules). Enquiry records are typically retained for up to 3
                  years; training records for up to 7 years as required by
                  regulators.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  10. Security
                </h2>
                <p>
                  We use industry-standard safeguards — HTTPS/TLS in transit,
                  encryption at rest for sensitive credentials, role-based
                  access controls, and routine security review — to protect
                  personal data. No method of transmission or storage is 100%
                  secure, but we work to minimise risk.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  11. Your Rights
                </h2>
                <p>Under the PDPA you have the right to:</p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>
                    Request access to a copy of the personal data we hold about
                    you;
                  </li>
                  <li>Request correction of inaccurate or incomplete data;</li>
                  <li>
                    Withdraw consent for the collection, use, or disclosure of
                    your personal data, subject to legal or contractual
                    restrictions;
                  </li>
                  <li>Request deletion of personal data we no longer need;</li>
                  <li>
                    Lodge a complaint with the Personal Data Protection
                    Commission of Singapore (PDPC) if you believe we have
                    mishandled your data.
                  </li>
                </ul>
                <p className="mt-3">
                  To exercise any of these rights, contact our Data Protection
                  Officer at{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-(--color-cyan) hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  . We will respond within 30 days.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  12. Children
                </h2>
                <p>
                  Our services are not directed at children under 13. We do not
                  knowingly collect personal data from children. If you believe
                  we have collected data from a child, please contact us and we
                  will delete it.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  13. Changes to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. The
                  current version is always posted at this URL with an updated
                  effective date. Material changes will be highlighted where
                  reasonable.
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  14. Contact Us
                </h2>
                <p>
                  Data Protection Officer
                  <br />
                  {COMPANY}
                  <br />
                  Singapore
                  <br />
                  Email:{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-(--color-cyan) hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  <br />
                  Or via our{" "}
                  <a
                    href="/contact"
                    className="text-(--color-cyan) hover:underline"
                  >
                    contact page
                  </a>
                  .
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
