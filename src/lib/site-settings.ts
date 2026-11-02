import { db } from "@/db";
import { settings } from "@/db/schema";
import { inArray } from "drizzle-orm";

const BRAND_KEYS = [
  "company_short_name",
  "company_name",
  "company_logo_url",
  "company_uen",
] as const;
type BrandKey = (typeof BRAND_KEYS)[number];

export type SiteBrand = {
  shortName: string;
  fullName: string;
  logoUrl: string | null;
  uen: string | null;
};

const DEFAULTS: SiteBrand = {
  shortName: "Tertiary Infotech Academy",
  fullName: "Tertiary Infotech Academy Pte Ltd",
  logoUrl: null,
  uen: null,
};

const LEAD_EMAIL_KEYS = [
  "lead_notification_email",
  "lead_notification_cc",
  "lead_email_subject",
  "lead_email_body",
] as const;
type LeadEmailKey = (typeof LEAD_EMAIL_KEYS)[number];

export type LeadEmailConfig = {
  to: string;
  cc: string;
  subject: string;
  body: string;
};

export const LEAD_EMAIL_DEFAULTS: LeadEmailConfig = {
  to: "angch@tertiaryinfotech.com",
  cc: "",
  subject: "Lead from {SOURCE_LABEL}: {NAME}",
  body: `<h2>Lead from {SOURCE_LABEL}</h2>
<p><strong>Name:</strong> {NAME}</p>
<p><strong>Email:</strong> <a href="mailto:{EMAIL}">{EMAIL}</a></p>
<p><strong>Company:</strong> {COMPANY}</p>
<p><strong>Phone:</strong> {PHONE}</p>
<p><strong>Source code:</strong> {SOURCE}</p>
<hr/>
<p style="white-space:pre-wrap">{MESSAGE}</p>`,
};

export const LEAD_SOURCE_LABELS_KEY = "lead_source_labels";

export const DEFAULT_LEAD_SOURCE_LABELS: Record<string, string> = {
  home: "General Inquiry",
  "free-trial": "Free Trial",
  "december-holiday-workshop": "December Holiday Workshop",
  "family-ai-starter-pack": "Family AI Starter Pack",
  "ssg-ato-page": "Courseware (SSG ATO)",
  "tpqa-page": "Courseware (TPQA)",
  "course-dev-page": "Courseware (WSQ Course Dev)",
  "lms-page": "Courseware (LMS)",
  "tms-page": "Courseware (TMS)",
  "cms-page": "Agentic (CMS)",
  "hrms-page": "Agentic (HRMS)",
  "ai-agent-page": "Agentic (AI Agent Deployment)",
  "ai-solutions-page": "Agentic (Full-Stack AI Solutions)",
  nemo: "Nemo Chatbot",
  "admin-test-email": "Admin Test",
};

export async function getLeadSourceLabels(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [LEAD_SOURCE_LABELS_KEY]));
    const row = rows[0];
    if (row && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row.value as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) out[k] = v.trim();
      }
      return { ...DEFAULT_LEAD_SOURCE_LABELS, ...out };
    }
  } catch {
    // fall through
  }
  return DEFAULT_LEAD_SOURCE_LABELS;
}

export function resolveSourceLabel(
  source: string | undefined | null,
  labels: Record<string, string>,
): string {
  if (!source) return "Unknown";
  return labels[source] ?? source;
}

export async function getLeadEmailConfig(): Promise<LeadEmailConfig> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, LEAD_EMAIL_KEYS as unknown as string[]));
    const map = new Map<LeadEmailKey, string>();
    for (const r of rows) {
      const v = typeof r.value === "string" ? r.value : "";
      map.set(r.key as LeadEmailKey, v);
    }
    return {
      to: map.get("lead_notification_email") || LEAD_EMAIL_DEFAULTS.to,
      cc: map.get("lead_notification_cc") ?? LEAD_EMAIL_DEFAULTS.cc,
      subject: map.get("lead_email_subject") || LEAD_EMAIL_DEFAULTS.subject,
      body: map.get("lead_email_body") || LEAD_EMAIL_DEFAULTS.body,
    };
  } catch {
    return LEAD_EMAIL_DEFAULTS;
  }
}

export async function getSiteBrand(): Promise<SiteBrand> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, BRAND_KEYS as unknown as string[]));
    const map = new Map<BrandKey, string>();
    for (const r of rows) {
      const v = typeof r.value === "string" ? r.value : "";
      if (v) map.set(r.key as BrandKey, v);
    }
    return {
      shortName: map.get("company_short_name") || DEFAULTS.shortName,
      fullName: map.get("company_name") || DEFAULTS.fullName,
      logoUrl: map.get("company_logo_url") || null,
      uen: map.get("company_uen") || null,
    };
  } catch {
    return DEFAULTS;
  }
}

// --- Company contact (Footer + Contact page) --------------------------------

const CONTACT_KEYS = [
  "company_email",
  "company_support_email",
  "company_tel",
  "company_whatsapp",
  "company_address",
  "company_website",
] as const;
type ContactKey = (typeof CONTACT_KEYS)[number];

export type CompanyContact = {
  /** Sales / commercial inbox (used for lead notifications + footer email). */
  email: string;
  /** Customer-support inbox (shown in footer alongside sales). */
  supportEmail: string;
  tel: string;
  /** International format without "+" — used for `https://wa.me/<n>`. */
  whatsapp: string;
  address: string;
  website: string;
};

export const CONTACT_DEFAULTS: CompanyContact = {
  email: "sales@tertiarycourses.com.sg",
  supportEmail: "enquiry@tertiaryinfotech.com",
  tel: "+6561000613",
  whatsapp: "6588666375",
  address: "12 Woodlands Square #07-85/86/87 Woods Square Tower 1, Singapore 737715",
  website: "https://www.tertiarycourses.com.sg/",
};

export async function getCompanyContact(): Promise<CompanyContact> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, CONTACT_KEYS as unknown as string[]));
    const map = new Map<ContactKey, string>();
    for (const r of rows) {
      const v = typeof r.value === "string" ? r.value : "";
      if (v) map.set(r.key as ContactKey, v);
    }
    return {
      email: map.get("company_email") || CONTACT_DEFAULTS.email,
      supportEmail: map.get("company_support_email") || CONTACT_DEFAULTS.supportEmail,
      tel: map.get("company_tel") || CONTACT_DEFAULTS.tel,
      whatsapp: (map.get("company_whatsapp") || CONTACT_DEFAULTS.whatsapp).replace(/\D/g, ""),
      address: map.get("company_address") || CONTACT_DEFAULTS.address,
      website: map.get("company_website") || CONTACT_DEFAULTS.website,
    };
  } catch {
    return CONTACT_DEFAULTS;
  }
}

// --- Service-page overrides (CMS editable per slug) ------------------------

import type { ServicePageContent } from "@/lib/service-pages";

/**
 * Read an admin override for a service page from `settings.value` keyed by
 * `service_page:<slug>`. Returns null if no override is saved — caller should
 * fall back to the file-based defaults in SERVICE_PAGES.
 */
export async function getServicePageOverride(
  slug: string,
): Promise<Partial<ServicePageContent> | null> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [`service_page:${slug}`] as unknown as string[]));
    if (!row) return null;
    const v = row.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Partial<ServicePageContent>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Merge the admin override (shallow) onto the file-based default. */
export function mergeServicePage(
  base: ServicePageContent,
  override: Partial<ServicePageContent> | null,
): ServicePageContent {
  if (!override) return base;
  return {
    ...base,
    ...override,
    hero: { ...base.hero, ...(override.hero ?? {}) },
    meta: { ...base.meta, ...(override.meta ?? {}) },
  };
}

// --- Social links (Footer) --------------------------------------------------

export type SocialLink = {
  platform: "facebook" | "linkedin" | "youtube" | "instagram" | "x" | "tiktok" | "whatsapp" | "github";
  href: string;
  label: string;
};

export const SOCIAL_DEFAULTS: SocialLink[] = [
  { platform: "facebook", href: "https://www.facebook.com/TertiaryCourses/", label: "Facebook" },
  { platform: "youtube", href: "https://www.youtube.com/@TertiaryCourses", label: "YouTube" },
  {
    platform: "linkedin",
    href: "https://www.linkedin.com/company/tertiaryinfotech/?originalSubdomain=sg",
    label: "LinkedIn",
  },
  { platform: "whatsapp", href: "https://wa.me/6588666375", label: "WhatsApp" },
];

// --- Homepage marketing copy (editable in /admin/settings/homepage) -------

export type HomepageCopy = {
  heroKicker: string;
  heroHeadlineHtml: string; // raw HTML — admin-trusted
  heroSubheadHtml: string;
  heroCtaPrimaryLabel: string;
  heroCtaPrimaryHref: string;
  heroCtaSecondaryLabel: string;
  heroCtaSecondaryHref: string;
  /** Legacy combined-services heading (kept for backward compat). */
  servicesKicker: string;
  servicesHeadlineHtml: string;
  /** New SSG-services section (rendered first). */
  ssgKicker: string;
  ssgHeadlineHtml: string;
  /** New AI-services section (rendered second). */
  aiKicker: string;
  aiHeadlineHtml: string;
  whyUsKicker: string;
  whyUsHeadlineHtml: string;
};

export const HOMEPAGE_COPY_DEFAULTS: HomepageCopy = {
  heroKicker: "EDTECH · AGENTIC AI · VIBE CODING",
  heroHeadlineHtml:
    'The AI-powered <span class="gradient-text">LMS &amp; TMS</span> built for <span class="text-white/85">WSQ compliance and TPQA audits</span>',
  heroSubheadHtml:
    "End-to-end open-source Learning &amp; Training Management Systems — augmented with Agentic AI, Claude Code, and AI Harness Systems — for Singapore training providers. SSG API integration works out of the box.<br/><br/><strong class=\"gradient-text-warm\">No per-user, per-transaction, or recurring cost.</strong>",
  heroCtaPrimaryLabel: "Explore AI-LMS-TMS",
  heroCtaPrimaryHref: "#ai-lms-tms",
  heroCtaSecondaryLabel: "Book a demo",
  heroCtaSecondaryHref: "#contact",
  servicesKicker: "[ WHAT WE BUILD ]",
  servicesHeadlineHtml:
    '<span class="gradient-text-warm">Agentic AI</span>-powered bespoke web &amp; mobile solutions for organizations.',
  ssgKicker: "[ SSG SERVICES ]",
  ssgHeadlineHtml:
    '<span class="gradient-text">SSG Services</span> for Registered Training Providers.',
  aiKicker: "[ AI SERVICES ]",
  aiHeadlineHtml:
    '<span class="gradient-text-warm">Agentic AI</span>-powered bespoke web &amp; mobile solutions for organizations.',
  whyUsKicker: "[ WHY TERTIARY ]",
  whyUsHeadlineHtml:
    'Built by <span class="gradient-text">Claude Code</span> and Agentic AI — for serious training providers.',
};

const HOMEPAGE_COPY_KEYS = [
  "hero_kicker",
  "hero_headline_html",
  "hero_subhead_html",
  "hero_cta_primary_label",
  "hero_cta_primary_href",
  "hero_cta_secondary_label",
  "hero_cta_secondary_href",
  "services_kicker",
  "services_headline_html",
  "ssg_kicker",
  "ssg_headline_html",
  "ai_kicker",
  "ai_headline_html",
  "why_us_kicker",
  "why_us_headline_html",
] as const;
type HomepageCopyKey = (typeof HOMEPAGE_COPY_KEYS)[number];

export async function getHomepageCopy(): Promise<HomepageCopy> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, HOMEPAGE_COPY_KEYS as unknown as string[]));
    const map = new Map<HomepageCopyKey, string>();
    for (const r of rows) {
      const v = typeof r.value === "string" ? r.value : "";
      if (v) map.set(r.key as HomepageCopyKey, v);
    }
    return {
      heroKicker: map.get("hero_kicker") || HOMEPAGE_COPY_DEFAULTS.heroKicker,
      heroHeadlineHtml:
        map.get("hero_headline_html") || HOMEPAGE_COPY_DEFAULTS.heroHeadlineHtml,
      heroSubheadHtml:
        map.get("hero_subhead_html") || HOMEPAGE_COPY_DEFAULTS.heroSubheadHtml,
      heroCtaPrimaryLabel:
        map.get("hero_cta_primary_label") || HOMEPAGE_COPY_DEFAULTS.heroCtaPrimaryLabel,
      heroCtaPrimaryHref:
        map.get("hero_cta_primary_href") || HOMEPAGE_COPY_DEFAULTS.heroCtaPrimaryHref,
      heroCtaSecondaryLabel:
        map.get("hero_cta_secondary_label") || HOMEPAGE_COPY_DEFAULTS.heroCtaSecondaryLabel,
      heroCtaSecondaryHref:
        map.get("hero_cta_secondary_href") || HOMEPAGE_COPY_DEFAULTS.heroCtaSecondaryHref,
      servicesKicker:
        map.get("services_kicker") || HOMEPAGE_COPY_DEFAULTS.servicesKicker,
      servicesHeadlineHtml:
        map.get("services_headline_html") || HOMEPAGE_COPY_DEFAULTS.servicesHeadlineHtml,
      ssgKicker: map.get("ssg_kicker") || HOMEPAGE_COPY_DEFAULTS.ssgKicker,
      ssgHeadlineHtml:
        map.get("ssg_headline_html") || HOMEPAGE_COPY_DEFAULTS.ssgHeadlineHtml,
      aiKicker: map.get("ai_kicker") || HOMEPAGE_COPY_DEFAULTS.aiKicker,
      aiHeadlineHtml:
        map.get("ai_headline_html") || HOMEPAGE_COPY_DEFAULTS.aiHeadlineHtml,
      whyUsKicker: map.get("why_us_kicker") || HOMEPAGE_COPY_DEFAULTS.whyUsKicker,
      whyUsHeadlineHtml:
        map.get("why_us_headline_html") || HOMEPAGE_COPY_DEFAULTS.whyUsHeadlineHtml,
    };
  } catch {
    return HOMEPAGE_COPY_DEFAULTS;
  }
}

// --- Hero KPI cards (editable in /admin/settings/homepage) ----------------

export type HeroKpi = {
  value: string;
  label: string;
  sublabel?: string;
  /** Optional href — internal route or external URL. */
  href?: string;
  /** When true the link opens in a new tab (always implicit for http* URLs). */
  openInNewTab?: boolean;
};

export const HERO_KPI_DEFAULTS: HeroKpi[] = [
  {
    value: "600+",
    label: "SSG Services",
    sublabel: "WSQ · IBF · CASL · ATO · TPQA",
    href: "/#services",
  },
  {
    value: "10+",
    label: "LMS & TMS Setup",
    sublabel: "SSG RTP · E-Learning",
    href: "/real-clients",
    openInNewTab: true,
  },
  {
    value: "50+",
    label: "Open-Source EdTools",
    sublabel: "Live Poll · Whiteboard · Flashcard",
    href: "https://github.com/alfredang?tab=repositories",
  },
  {
    value: "10+",
    label: "AI Agents Deployed",
    sublabel: "OpenClaw · Hermes Agent · Nebula",
    href: "/ai-agent-deployment",
  },
];

export async function getHeroKpis(): Promise<HeroKpi[]> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, ["hero_kpis"] as unknown as string[]));
    if (!row) return HERO_KPI_DEFAULTS;
    const v = row.value;
    if (Array.isArray(v) && v.length > 0) {
      return (v as HeroKpi[]).filter(
        (k) => k && typeof k.value === "string" && typeof k.label === "string",
      );
    }
    return HERO_KPI_DEFAULTS;
  } catch {
    return HERO_KPI_DEFAULTS;
  }
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, ["social_links"] as unknown as string[]));
    if (!row) return SOCIAL_DEFAULTS;
    const v = row.value;
    if (Array.isArray(v)) {
      return (v as SocialLink[]).filter(
        (l) => l && typeof l.href === "string" && typeof l.platform === "string",
      );
    }
    return SOCIAL_DEFAULTS;
  } catch {
    return SOCIAL_DEFAULTS;
  }
}
