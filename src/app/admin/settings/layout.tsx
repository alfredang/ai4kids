import Link from "next/link";

const tabs = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/company", label: "Company" },
  { href: "/admin/settings/lead-email", label: "Lead Email" },
  { href: "/admin/settings/credentials", label: "Credentials" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Settings</h1>
        <p className="text-sm text-(--color-muted) mt-1">
          Manage site settings, integrations, and API credentials.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-white/10 mb-8 -mx-8 px-8">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:text-(--color-cyan) hover:border-(--color-cyan)/40 -mb-px transition"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
