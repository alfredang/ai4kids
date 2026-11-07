"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { KidsIcon } from "@/components/public/KidsIcon";

export function FamilyLoginForm() {
  const [tab, setTab] = useState<"kid" | "parent" | "admin">("parent");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => response.json())
      .then((providers) => setGoogleEnabled(Boolean(providers.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  function destination() {
    const requested = new URL(window.location.href).searchParams.get("callbackUrl");
    if (requested) {
      const target = new URL(requested, window.location.origin);
      if (target.origin === window.location.origin && !target.pathname.startsWith("/login")) {
        return target.pathname + target.search;
      }
    }
    return tab === "parent" ? "/parent/play" : "/dashboard";
  }

  async function handleKidLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("That sign-in didn’t work. Check your details and try again.");
    } else {
      // Signing in as a kid drops any leftover staff admin session in this
      // browser, so a kid account can't carry admin powers.
      await fetch("/api/portal/drop-admin", { method: "POST" }).catch(() => {});
      window.location.href = destination();
    }
  }

  const parent = tab === "parent";
  const TABS = [
    { id: "parent", label: "Parent", icon: "home" },
    { id: "kid", label: "Child", icon: "bag" },
    { id: "admin", label: "Staff", icon: "shield" },
  ] as const;

  return (
    <div className="kids-signin-card">
      <div className="kids-signin-tabs" role="group" aria-label="Who is signing in?">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={tab === t.id ? "is-active" : ""}
          >
            <KidsIcon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "admin" ? (
        <div className="kids-signin-staff">
          <h2>Hello, team!</h2>
          <p>Academy instructors and staff sign in on the staff page.</p>
          <Link href="/admin/login" className="kids-button">
            Go to staff sign-in <KidsIcon name="arrow" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleKidLogin}>
          <h2>{parent ? "Hello, grown-up!" : "Hi there, explorer!"}</h2>
          <p>
            {parent
              ? "Sign in, then choose your child’s profile."
              : "Ask your parent for your username and secret word."}
          </p>
          <label htmlFor="family-identifier">{parent ? "Your email" : "Your username"}</label>
          <input
            id="family-identifier"
            type={parent ? "email" : "text"}
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={parent ? "you@example.com" : "e.g. supernova"}
            autoCapitalize="none"
          />
          <label htmlFor="family-password">{parent ? "Your password" : "Your secret word"}</label>
          <input
            id="family-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="kids-signin-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="kids-button">
            {loading ? "Signing in…" : parent ? "Unlock our playground" : "Let’s go!"}
            {!loading && <KidsIcon name="arrow" />}
          </button>
          {parent && googleEnabled && (
            <>
              <button
                type="button"
                className="kids-signin-google"
                onClick={async () => {
                  // Drop any leftover staff admin cookie before the OAuth redirect.
                  await fetch("/api/portal/drop-admin", { method: "POST" }).catch(() => {});
                  signIn("google", { callbackUrl: destination() });
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Continue with Google
              </button>
              <small>New here? Signing in creates your parent account automatically.</small>
            </>
          )}
          {parent && !googleEnabled && (
            <small>
              Need a parent account? <Link href="/#enquire">Ask our friendly team.</Link>
            </small>
          )}
        </form>
      )}
    </div>
  );
}
