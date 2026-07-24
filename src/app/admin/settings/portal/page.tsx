import { revalidatePath } from "next/cache";
import { getPayNowConfig, getWhatsAppNumber, setPortalSetting } from "@/lib/portal-settings";
import { requireStaff } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function PortalSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const paynow = await getPayNowConfig();
  const whatsapp = await getWhatsAppNumber();

  async function save(formData: FormData) {
    "use server";
    await requireStaff();
    await setPortalSetting("paynow_uen", String(formData.get("uen") || "").trim());
    await setPortalSetting("paynow_payee_name", String(formData.get("payee") || "").trim());
    await setPortalSetting("whatsapp_number", String(formData.get("whatsapp") || "").replace(/[^0-9]/g, ""));
    revalidatePath("/admin/settings/portal");
    revalidatePath("/", "layout");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white">Portal settings</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Payment details used for booking confirmation emails, and the WhatsApp number for the floating chat button.
      </p>
      {saved && <div className="mt-3 rounded bg-green/20 px-3 py-2 text-sm text-green">Saved ✓</div>}

      <form action={save} className="mt-5 space-y-4">
        <label className="block text-sm text-[var(--color-muted)]">PayNow UEN
          <input name="uen" defaultValue={paynow?.uen ?? ""} placeholder="e.g. 201200696W" className="ti-input mt-1" />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">PayNow payee name
          <input name="payee" defaultValue={paynow?.payeeName ?? "AI Kids Academy"} className="ti-input mt-1" />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">WhatsApp number (digits only, with country code)
          <input name="whatsapp" defaultValue={whatsapp ?? ""} placeholder="6588666375" className="ti-input mt-1" />
        </label>
        <button className="ti-btn">Save settings</button>
      </form>

      <p className="mt-6 text-xs text-[var(--color-muted)]">
        AI activities + chatbot use the Anthropic token configured under
        Settings → Credentials (inherited admin). Gmail OAuth (for sending the PayNow
        email) is configured there too.
      </p>
    </div>
  );
}
