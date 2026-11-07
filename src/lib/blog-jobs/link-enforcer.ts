/**
 * Counts in-body links and, if quotas miss, appends a "Related from
 * Tertiary Infotech Academy" block so every auto-blog meets the link
 * minimums defined in .claude/skills/blog-post/SKILL.md.
 *
 * Minimums:
 *   - >=3 internal `/...` links
 *   - >=2 tertiarycourses.com.sg deep links (never bare homepage)
 *   - >=3 CTA links to /contact?source=blog-...
 */

export type LinkCounts = {
  internal: number;
  tertiaryCourses: number;
  contactCta: number;
};

const TC_HOST_RE = /https?:\/\/(?:www\.)?tertiarycourses\.com\.sg\//i;
const TC_HOMEPAGE_RE = /^https?:\/\/(?:www\.)?tertiarycourses\.com\.sg\/?(?:\?[^"#]*)?(?:#[^"]*)?$/i;
const HREF_RE = /<a\s+[^>]*?href="([^"]+)"/gi;

/**
 * Force every `<a href="...">` in the body to open in a new tab and carry
 * `rel="noopener noreferrer"`. Defensive — the writer agent is told to emit
 * these inline, but the post-processor guarantees the rule even if the LLM
 * forgets. Idempotent: a second pass over already-correct HTML is a no-op.
 *
 * Special cases:
 *   - Anchor-only links (`href="#section"`) are skipped (in-page jumps).
 *   - `mailto:` and `tel:` are skipped (don't open a tab anyway).
 */
/**
 * Canonical-URL rewrites for known recurring link bugs. Apply BEFORE
 * counting links so we don't credit a quota slot to a broken URL.
 *   - `ai-courses-singapore.html` (does not exist) → the real AI category
 *     index `artificial-intelligence-courses.html`. See the blog-post skill.
 */
const TC_URL_REWRITES: Array<[RegExp, string]> = [
  [
    /https?:\/\/(?:www\.)?tertiarycourses\.com\.sg\/ai-courses-singapore\.html/gi,
    "https://www.tertiarycourses.com.sg/artificial-intelligence-courses.html",
  ],
];

export function rewriteKnownBadLinks(html: string): string {
  let out = html;
  for (const [re, replacement] of TC_URL_REWRITES) out = out.replace(re, replacement);
  return out;
}

export function ensureLinksOpenInNewTab(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href="([^"]+)"([^>]*?)>/gi,
    (full, pre: string, href: string, post: string) => {
      if (/^(#|mailto:|tel:)/i.test(href)) return full;
      const attrs = `${pre}${post}`;
      let next = attrs;
      if (!/\btarget\s*=/i.test(next)) {
        next = ` target="_blank"${next}`;
      } else {
        next = next.replace(/\btarget\s*=\s*"[^"]*"/i, 'target="_blank"');
      }
      if (!/\brel\s*=/i.test(next)) {
        next = ` rel="noopener noreferrer"${next}`;
      } else {
        next = next.replace(/\brel\s*=\s*"([^"]*)"/i, (_, cur: string) => {
          const tokens = new Set(cur.split(/\s+/).filter(Boolean));
          tokens.add("noopener");
          tokens.add("noreferrer");
          return `rel="${Array.from(tokens).join(" ")}"`;
        });
      }
      return `<a${next.startsWith(" ") ? "" : " "}${next}href="${href}">`;
    },
  );
}

export function countLinks(html: string): LinkCounts {
  let internal = 0;
  let tertiaryCourses = 0;
  let contactCta = 0;
  for (const m of html.matchAll(HREF_RE)) {
    const href = m[1];
    if (/^\/contact\b/.test(href) && /[?&]source=blog-/i.test(href)) contactCta++;
    if (/^\//.test(href)) internal++;
    if (TC_HOST_RE.test(href) && !TC_HOMEPAGE_RE.test(href)) tertiaryCourses++;
  }
  return { internal, tertiaryCourses, contactCta };
}

/**
 * Append a related-links section to satisfy any unmet quotas. We bias toward
 * the well-known canonical destinations from the blog-post skill so we never
 * point at a stale URL.
 */
export function enforceLinks(
  html: string,
  slugToken: string,
): { html: string; counts: LinkCounts; appended: boolean } {
  const before = countLinks(html);
  const needInternal = Math.max(0, 3 - before.internal);
  const needTC = Math.max(0, 2 - before.tertiaryCourses);
  const needCta = Math.max(0, 3 - before.contactCta);
  if (!needInternal && !needTC && !needCta) {
    return { html, counts: before, appended: false };
  }

  const internalCandidates = [
    { href: "/#workshops", text: "December family workshops" },
    { href: "/programs", text: "AI programmes for kids" },
    { href: "/games", text: "AI games for kids" },
    { href: "/free-trial", text: "Free trial class" },
    { href: "/downloads/family-ai-starter-pack.html", text: "Free family activity pack" },
  ];
  const tcCandidates = [
    {
      href: "https://www.tertiarycourses.com.sg/artificial-intelligence-courses.html",
      text: "AI courses at Tertiary Courses Singapore",
    },
    {
      href: "https://www.tertiarycourses.com.sg/data-science-courses-singapore.html",
      text: "Data Science training at Tertiary Courses Singapore",
    },
  ];
  const ctaCandidates = [
    { href: `/contact?source=blog-${slugToken}-related`, text: "Book a 30-minute walkthrough" },
    { href: `/contact?source=blog-${slugToken}-quote`, text: "Request a deployment quote" },
    { href: `/contact?source=blog-${slugToken}-demo`, text: "Schedule a demo" },
  ];

  const lis: string[] = [];
  for (let i = 0; i < needInternal && i < internalCandidates.length; i++) {
    const c = internalCandidates[i];
    lis.push(
      `<li><a href="${c.href}" target="_blank" rel="noopener noreferrer">${c.text}</a> — explore the service page.</li>`,
    );
  }
  for (let i = 0; i < needTC && i < tcCandidates.length; i++) {
    const c = tcCandidates[i];
    lis.push(
      `<li><a href="${c.href}" target="_blank" rel="noopener noreferrer">${c.text}</a> — browse the catalogue.</li>`,
    );
  }
  for (let i = 0; i < needCta && i < ctaCandidates.length; i++) {
    const c = ctaCandidates[i];
    lis.push(
      `<li><a href="${c.href}" target="_blank" rel="noopener noreferrer">${c.text}</a>.</li>`,
    );
  }

  const block = `\n<h2>Related from Tertiary Infotech Academy</h2>\n<ul>\n${lis.join("\n")}\n</ul>\n`;
  const out = html + block;
  return { html: out, counts: countLinks(out), appended: true };
}
