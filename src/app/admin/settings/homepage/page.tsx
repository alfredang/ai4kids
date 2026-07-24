import { db } from "@/db";
import { settings } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SavedToast } from "@/app/admin/_components/SavedToast";
import { requireStaff } from "@/lib/admin-guard";
import {
  HOMEPAGE_COPY_DEFAULTS,
  HERO_KPI_DEFAULTS,
  type HeroKpi,
} from "@/lib/site-settings";

const MAX_KPIS = 4;

type Field = {
  key: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  defaultValue: string;
  group: "hero" | "ssg" | "ai" | "why-us";
};

const FIELDS: Field[] = [
  { group: "hero", key: "hero_kicker", label: "Hero kicker", defaultValue: HOMEPAGE_COPY_DEFAULTS.heroKicker },
  {
    group: "hero",
    key: "hero_headline_html",
    label: "Hero headline (HTML)",
    multiline: true,
    hint: "HTML is allowed — use <span class=\"gradient-text\">…</span> for accent words.",
    defaultValue: HOMEPAGE_COPY_DEFAULTS.heroHeadlineHtml,
  },
  {
    group: "hero",
    key: "hero_subhead_html",
    label: "Hero subhead (HTML)",
    multiline: true,
    defaultValue: HOMEPAGE_COPY_DEFAULTS.heroSubheadHtml,
  },
  { group: "hero", key: "hero_cta_primary_label", label: "Primary CTA label", defaultValue: HOMEPAGE_COPY_DEFAULTS.heroCtaPrimaryLabel },
  { group: "hero", key: "hero_cta_primary_href", label: "Primary CTA href", defaultValue: HOMEPAGE_COPY_DEFAULTS.heroCtaPrimaryHref },
  { group: "hero", key: "hero_cta_secondary_label", label: "Secondary CTA label", defaultValue: HOMEPAGE_COPY_DEFAULTS.heroCtaSecondaryLabel },
  { group: "hero", key: "hero_cta_secondary_href", label: "Secondary CTA href", defaultValue: HOMEPAGE_COPY_DEFAULTS.heroCtaSecondaryHref },
  { group: "ssg", key: "ssg_kicker", label: "SSG-services kicker", defaultValue: HOMEPAGE_COPY_DEFAULTS.ssgKicker },
  {
    group: "ssg",
    key: "ssg_headline_html",
    label: "SSG-services headline (HTML)",
    multiline: true,
    defaultValue: HOMEPAGE_COPY_DEFAULTS.ssgHeadlineHtml,
  },
  { group: "ai", key: "ai_kicker", label: "AI-services kicker", defaultValue: HOMEPAGE_COPY_DEFAULTS.aiKicker },
  {
    group: "ai",
    key: "ai_headline_html",
    label: "AI-services headline (HTML)",
    multiline: true,
    defaultValue: HOMEPAGE_COPY_DEFAULTS.aiHeadlineHtml,
  },
  { group: "why-us", key: "why_us_kicker", label: "Why-us kicker", defaultValue: HOMEPAGE_COPY_DEFAULTS.whyUsKicker },
  {
    group: "why-us",
    key: "why_us_headline_html",
    label: "Why-us headline (HTML)",
    multiline: true,
    defaultValue: HOMEPAGE_COPY_DEFAULTS.whyUsHeadlineHtml,
  },
];

const GROUPS: Array<{ id: Field["group"]; title: string; description: string }> = [
  { id: "hero", title: "Hero section", description: "Top-of-page headline, subhead, and CTAs." },
  { id: "ssg", title: "SSG Services section", description: "Kicker + heading for the SSG-services grid (Course Dev · ATO · TPQA)." },
  { id: "ai", title: "AI Services section", description: "Kicker + heading for the AI-services grid (TMS · LMS · AI Solutions)." },
  { id: "why-us", title: "Why-us section", description: "Kicker + heading for the differentiators band." },
];

export default async function HomepageCopyPage() {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((s) => [s.key, s.value]));

  const storedKpis = map.get("hero_kpis");
  const kpis: HeroKpi[] = Array.isArray(storedKpis)
    ? (storedKpis as HeroKpi[])
    : HERO_KPI_DEFAULTS;
  const kpiSlots: (HeroKpi | null)[] = Array.from({ length: MAX_KPIS }, (_, i) => kpis[i] ?? null);

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
    // hero KPI cards
    const heroKpis: HeroKpi[] = [];
    for (let i = 0; i < MAX_KPIS; i++) {
      const value = String(formData.get(`kpi_${i}_value`) ?? "").trim();
      const label = String(formData.get(`kpi_${i}_label`) ?? "").trim();
      const sublabel = String(formData.get(`kpi_${i}_sublabel`) ?? "").trim();
      const href = String(formData.get(`kpi_${i}_href`) ?? "").trim();
      const openInNewTab = formData.get(`kpi_${i}_new_tab`) === "on";
      if (value && label) {
        heroKpis.push({
          value,
          label,
          sublabel: sublabel || undefined,
          href: href || undefined,
          openInNewTab: openInNewTab || undefined,
        });
      }
    }
    await db
      .insert(settings)
      .values({ key: "hero_kpis", value: heroKpis as unknown as object })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: heroKpis as unknown as object, updatedAt: new Date() },
      });
    revalidatePath("/admin/settings/homepage");
    revalidatePath("/");
    redirect("/admin/settings/homepage?saved=1");
  }

  return (
    <div>
      <SavedToast />
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Homepage copy</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Hero headline, subheads, kickers and CTAs that appear on the public homepage. HTML is
          allowed in the labelled fields — use it to add accent colors (
          <code className="text-(--color-cyan)">&lt;span class=&quot;gradient-text&quot;&gt;…&lt;/span&gt;</code>
          ). Plain text is also fine.
        </p>
      </div>
      <form action={save} className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.id} className="glass p-6 space-y-5">
            <div>
              <h3 className="font-display font-bold text-base">{g.title}</h3>
              <p className="text-xs text-(--color-muted) mt-1">{g.description}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-x-5 gap-y-4">
              {FIELDS.filter((f) => f.group === g.id).map((f) => (
                <div key={f.key} className={f.multiline ? "md:col-span-2" : undefined}>
                  <label className="kicker block mb-2">{f.label}</label>
                  {f.multiline ? (
                    <textarea
                      name={f.key}
                      rows={3}
                      defaultValue={String(map.get(f.key) ?? f.defaultValue)}
                      className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition font-mono text-sm"
                    />
                  ) : (
                    <input
                      name={f.key}
                      type="text"
                      defaultValue={String(map.get(f.key) ?? f.defaultValue)}
                      className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
                    />
                  )}
                  {f.hint && <p className="text-[11px] text-(--color-muted) mt-1">{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Hero KPI cards */}
        <div className="glass p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-base">Hero KPI cards</h3>
            <p className="text-xs text-(--color-muted) mt-1">
              Four stat cards under the hero CTAs. Leave a row blank to hide it.
              Optional href can be an internal path (e.g. <code>/#services</code>) or external URL.
            </p>
          </div>
          <div className="space-y-3">
            {kpiSlots.map((slot, i) => (
              <div key={i} className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_1.5fr_180px] gap-3">
                  <input
                    name={`kpi_${i}_value`}
                    type="text"
                    defaultValue={slot?.value ?? ""}
                    placeholder="1,000+"
                    className="px-3 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm font-display font-semibold"
                  />
                  <input
                    name={`kpi_${i}_label`}
                    type="text"
                    defaultValue={slot?.label ?? ""}
                    placeholder="SSG Services"
                    className="px-3 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
                  />
                  <input
                    name={`kpi_${i}_sublabel`}
                    type="text"
                    defaultValue={slot?.sublabel ?? ""}
                    placeholder="WSQ · IBF · CASL · ATO · TPQA"
                    className="px-3 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
                  />
                  <input
                    name={`kpi_${i}_href`}
                    type="text"
                    defaultValue={slot?.href ?? ""}
                    placeholder="/#services"
                    className="px-3 py-2.5 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm font-mono"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-(--color-muted) ml-1">
                  <input
                    type="checkbox"
                    name={`kpi_${i}_new_tab`}
                    defaultChecked={slot?.openInNewTab ?? false}
                    className="accent-(--color-cyan)"
                  />
                  Open in new tab
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end pt-4">
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
