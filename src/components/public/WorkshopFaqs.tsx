import type { WorkshopFaq } from "@/lib/public-site";

/** Visible FAQ list plus the FAQPage JSON-LD that mirrors it one to one. */
export function WorkshopFaqs({
  heading,
  intro,
  faqs,
}: {
  heading: string;
  intro: string;
  faqs: readonly WorkshopFaq[];
}) {
  return (
    <section className="kids-faq-section">
      <div>
        <span className="kids-eyebrow">FOR THE GROWN-UPS</span>
        <h2>{heading}</h2>
        <p>{intro}</p>
      </div>
      <div className="kids-faq-list">
        {faqs.map((f) => (
          <details key={f.question}>
            <summary>
              {f.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
