import { db } from "@/db";
import { settings } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SavedToast } from "@/app/admin/_components/SavedToast";
import { SERVICE_PAGES } from "@/lib/service-pages";
import { requireStaff } from "@/lib/admin-guard";

const SLUGS = Object.keys(SERVICE_PAGES);

export default async function ServicePagesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: rawSlug } = await searchParams;
  const activeSlug = rawSlug && SLUGS.includes(rawSlug) ? rawSlug : SLUGS[0];
  const baseContent = SERVICE_PAGES[activeSlug];

  // Load any saved override.
  const [row] = await db.select().from(settings);
  const allRows = await db.select().from(settings);
  const map = new Map(allRows.map((s) => [s.key, s.value]));
  const overrideRow = map.get(`service_page:${activeSlug}`);
  const override = (overrideRow && typeof overrideRow === "object" && !Array.isArray(overrideRow))
    ? overrideRow
    : null;
  // For the textarea, pretty-print the override (if any) or the base content
  const initialJson = JSON.stringify(override ?? baseContent, null, 2);

  async function save(formData: FormData) {
    "use server";
    await requireStaff();
    const slug = String(formData.get("slug") ?? "").trim();
    const raw = String(formData.get("json") ?? "").trim();
    const action = String(formData.get("action") ?? "save");
    if (!SLUGS.includes(slug)) {
      throw new Error("Unknown service slug");
    }
    if (action === "reset") {
      // Delete the override row entirely; the page falls back to file defaults.
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM settings WHERE key = ${`service_page:${slug}`}`);
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      await db
        .insert(settings)
        .values({ key: `service_page:${slug}`, value: parsed as unknown as object })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: parsed as unknown as object, updatedAt: new Date() },
        });
    }
    revalidatePath(`/${slug}`);
    revalidatePath("/admin/settings/service-pages");
    redirect(`/admin/settings/service-pages?slug=${slug}&saved=1`);
  }

  // Silence unused row variable from the throw-away pattern above.
  void row;

  return (
    <div>
      <SavedToast />
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold">Service landing pages</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Each row in the homepage Services grid links to a dedicated lead-gen page. Edit any field
          on a service page here — hero copy, timeline steps, benefits, FAQ, SEO meta — and the
          public page reflects within seconds. Leave a service unchanged to use the file-based
          defaults.
        </p>
      </div>

      {/* Service tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SLUGS.map((s) => (
          <a
            key={s}
            href={`/admin/settings/service-pages?slug=${s}`}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border transition ${
              s === activeSlug
                ? "bg-(--color-cyan)/10 border-(--color-cyan)/40 text-(--color-cyan)"
                : "border-white/10 text-white/65 hover:text-white hover:border-white/25"
            }`}
          >
            {SERVICE_PAGES[s].title}
          </a>
        ))}
      </div>

      <form action={save} className="glass p-6 space-y-4">
        <input type="hidden" name="slug" value={activeSlug} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display font-bold text-base">{baseContent.title}</h3>
            <p className="text-xs text-(--color-muted)">
              <code className="text-(--color-cyan)">{`/${activeSlug}`}</code> ·{" "}
              {override ? (
                <span className="text-(--color-amber)">Admin override active</span>
              ) : (
                <span className="text-white/45">Using file defaults</span>
              )}
            </p>
          </div>
          <a
            href={`/${activeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-(--color-cyan) hover:underline"
          >
            View live page →
          </a>
        </div>

        <div>
          <label className="kicker block mb-2" htmlFor="json-editor">
            Page content (JSON)
          </label>
          <textarea
            id="json-editor"
            name="json"
            rows={30}
            defaultValue={initialJson}
            spellCheck={false}
            className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition font-mono text-xs leading-relaxed"
          />
          <p className="text-[11px] text-(--color-muted) mt-2 font-mono leading-relaxed">
            Editable fields: <code>hero.kicker</code>, <code>hero.headlineHtml</code>,{" "}
            <code>hero.subhead</code>, <code>meta.title</code>, <code>meta.description</code>,{" "}
            <code>processIntro</code>, <code>timeline[].title/duration/body/accent</code>,{" "}
            <code>benefits[].title/body</code>, <code>whatsIncluded[]</code>,{" "}
            <code>faq[].q/a</code>. Accent values: cyan · blue · purple · amber · green.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            type="submit"
            name="action"
            value="reset"
            className="text-xs font-mono text-red-400 hover:text-red-300"
          >
            Reset to file defaults
          </button>
          <button type="submit" name="action" value="save" className="btn-primary">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
