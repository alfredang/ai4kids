"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { KidsIcon } from "@/components/public/KidsIcon";

export default function LoginPage() {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky/20 via-cream to-coral/20 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl ring-1 ring-amber-100">
        <Link href="/" className="flex items-center justify-center gap-2 font-fun text-2xl font-700 text-slate-800">
          <KidsIcon name="sun" /> AI <span className="text-coral">Kids</span>
        </Link>

        <div className="mt-6 grid grid-cols-3 gap-1.5 rounded-full bg-amber-50 p-1 font-fun text-sm font-600">
          <button
            onClick={() => setTab("kid")}
            className={`rounded-full py-2 transition ${tab === "kid" ? "bg-coral text-white shadow" : "text-slate-500"}`}
          >
            <KidsIcon name="bag" /> Child
          </button>
          <button
            onClick={() => setTab("parent")}
            className={`rounded-full py-2 transition ${tab === "parent" ? "bg-sky-500 text-white shadow" : "text-slate-500"}`}
          >
            <KidsIcon name="home" /> Parent
          </button>
          <button
            onClick={() => setTab("admin")}
            className={`rounded-full py-2 transition ${tab === "admin" ? "bg-slate-700 text-white shadow" : "text-slate-500"}`}
          >
            <KidsIcon name="shield" /> Staff
          </button>
        </div>

        {tab === "kid" || tab === "parent" ? (
          <form onSubmit={handleKidLogin} className="mt-6 space-y-4">
            {tab === "parent" && <p className="font-round text-slate-600">A grown-up signs in, then chooses a child’s profile.</p>}
            <div>
              <label htmlFor="family-identifier" className="font-fun font-600 text-sm text-slate-600">{tab === "parent" ? "Parent email" : "Username"}</label>
              <input
                id="family-identifier"
                type={tab === "parent" ? "email" : "text"}
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={tab === "parent" ? "you@example.com" : "e.g. supernova"}
                autoCapitalize="none"
                className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
              />
            </div>
            <div>
              <label htmlFor="family-password" className="font-fun font-600 text-sm text-slate-600">Password</label>
              <input
                id="family-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="your secret word"
                className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
              />
            </div>
            {error && <p className="text-sm text-coral">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-2xl bg-coral py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? "Signing in…" : tab === "parent" ? "Unlock our playground" : "Let’s go!"}
            </button>
            {tab === "kid" && <p className="text-center text-sm text-slate-500">
              Ask your parent for your username and secret word.
            </p>}
            {tab === "parent" && googleEnabled && <>
            <button
              type="button"
              onClick={async () => {
                // Drop any leftover staff admin cookie before the OAuth redirect.
                await fetch("/api/portal/drop-admin", { method: "POST" }).catch(() => {});
                signIn("google", { callbackUrl: destination() });
              }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white py-3 font-fun font-600 text-slate-700 transition hover:bg-slate-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
              Continue with Google
            </button>
            <p className="text-center text-xs text-slate-400">
              New here? Signing in creates your parent account automatically.
            </p>
            </>}
            {tab === "parent" && !googleEnabled && <p className="text-sm text-slate-600">Need a parent account? <Link href="/#enquire" className="font-bold underline">Ask our friendly team.</Link></p>}
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-center font-round text-slate-500">
              Staff &amp; admins sign in on the secure admin page.
            </p>
            <Link
              href="/admin/login"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 font-fun font-700 text-white shadow-lg transition hover:bg-slate-900"
            >
              🔐 Go to Admin login →
            </Link>
            <p className="text-center text-xs text-slate-400">
              For academy instructors and staff only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
