import { db } from "@/db";
import { settings } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SavedToast } from "@/app/admin/_components/SavedToast";
import { SOCIAL_DEFAULTS, type SocialLink } from "@/lib/site-settings";
import { LogoUploader } from "@/components/admin/LogoUploader";
import { requireStaff } from "@/lib/admin-guard";

const FIELDS: Array<{
  key: string;
  label: string;
  type?: string;
  full?: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
}> = [
  { key: "company_name", label: "Company Name", defaultValue: "Tertiary Infotech Academy Pte Ltd" },
  { key: "company_short_name", label: "Company Short Name (shown in nav & footer)", defaultValue: "Tertiary Infotech Academy" },
  { key: "company_uen", label: "UEN", defaultValue: "201200696W" },
  { key: "company_website", label: "Company Website", type: "url", defaultValue: "https://www.tertiarycourses.com.sg/" },
  { key: "company_email", label: "Sales / Lead Email", type: "email", defaultValue: "sales@tertiarycourses.com.sg" },
  {
    key: "company_support_email",
    label: "Support Email",
    type: "email",
    defaultValue: "enquiry@tertiaryinfotech.com",
    hint: "Shown in the footer alongside the sales email. Use a separate inbox for incoming customer support.",
  },
  { key: "company_tel", label: "Company Tel", type: "tel", defaultValue: "+6561000613" },
  {
    key: "company_whatsapp",
    label: "WhatsApp number (digits only, with country code)",
    type: "tel",
    defaultValue: "6588666375",
    hint: "Used to build https://wa.me/<this>. No '+' or spaces.",
  },
  {
    key: "company_address",
    label: "Company Address",
    full: true,
    defaultValue: "12 Woodlands Square #07-85/86/87 Woods Square Tower 1, Singapore 737715",
  },
];

const PLATFORMS: SocialLink["platform"][] = [
  "facebook",
  "linkedin",
  "youtube",
  "instagram",
  "x",
  "tiktok",
  "whatsapp",
  "github",
];

const MAX_SOCIAL_SLOTS = 6;

export default async function CompanyInfoPage() {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((s) => [s.key, s.value]));

  const storedSocial = map.get("social_links");
  const socialLinks: SocialLink[] = Array.isArray(storedSocial)
    ? (storedSocial as SocialLink[])
    : SOCIAL_DEFAULTS;
  const socialSlots: (SocialLink | null)[] = Array.from({ length: MAX_SOCIAL_SLOTS }, (_, i) =>
    socialLinks[i] ?? null,
  );

  async function save(formData: FormData) {
    "use server";
    await requireStaff();
    for (const f of FIELDS) {
      const v = String(formData.get(f.key) ?? "").trim();
      await db
        .insert(settings)
        .values({ key: f.key, value: v as unknown as object })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: v as unknown as object, updatedAt: new Date() },
        });
    }
    // social links — collect filled rows
    const links: SocialLink[] = [];
    for (let i = 0; i < MAX_SOCIAL_SLOTS; i++) {
      const platform = String(formData.get(`social_${i}_platform`) ?? "").trim();
      const href = String(formData.get(`social_${i}_href`) ?? "").trim();
      const label = String(formData.get(`social_${i}_label`) ?? "").trim();
      if (platform && href && PLATFORMS.includes(platform as SocialLink["platform"])) {
        links.push({
          platform: platform as SocialLink["platform"],
          href,
          label: label || platform,
        });
      }
    }
    await db
      .insert(settings)
      .values({ key: "social_links", value: links as unknown as object })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: links as unknown as object, updatedAt: new Date() },
      });
    revalidatePath("/admin/settings/company");
    revalidatePath("/");
    revalidatePath("/contact");
    redirect("/admin/settings/company?saved=1");
  }

  return (
    <div>
      <SavedToast />
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Company Info</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Legal entity details used on invoices, vouchers, and emails.
        </p>
      </div>
      <form action={save} className="glass p-6 space-y-8">
        <div>
          <label className="kicker block mb-3">Company logo + favicon</label>
          <LogoUploader
            name="company_logo_url"
            initialValue={String(map.get("company_logo_url") ?? "")}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-x-5 gap-y-5">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.full ? "md:col-span-3" : undefined}>
              <label className="kicker block mb-2">{f.label}</label>
              <input
                name={f.key}
                type={f.type ?? "text"}
                defaultValue={String(map.get(f.key) ?? f.defaultValue ?? "")}
                placeholder={f.placeholder}
                className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
              />
              {f.hint && (
                <p className="text-[11px] text-(--color-muted) mt-1">{f.hint}</p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-6">
          <h3 className="font-display font-bold text-base mb-1">Social links</h3>
          <p className="text-xs text-(--color-muted) mb-4">
            Shown as icons in the footer. Leave a row blank to hide it.
          </p>
          <div className="space-y-3">
            {socialSlots.map((slot, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[160px_1fr_180px] gap-3">
                <select
                  name={`social_${i}_platform`}
                  defaultValue={slot?.platform ?? ""}
                  className="px-3 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
                >
                  <option value="">— platform —</option>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  name={`social_${i}_href`}
                  type="url"
                  defaultValue={slot?.href ?? ""}
                  placeholder="https://..."
                  className="px-4 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
                />
                <input
                  name={`social_${i}_label`}
                  type="text"
                  defaultValue={slot?.label ?? ""}
                  placeholder="aria-label (optional)"
                  className="px-4 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-white/5">
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
