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
