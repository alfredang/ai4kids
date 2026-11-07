"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { KidsLogo } from "@/components/public/KidsLogo";
import { PipMascot } from "@/components/public/PipMascot";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => response.json())
      .then((providers) => setGoogleEnabled(Boolean(providers.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);
  const params = useSearchParams();
  const from = params.get("from") ?? "/admin";
  const oauthError = params.get("error");

  function onGoogleSignIn() {
    setLoading(true);
    const callbackUrl = `/api/admin/oauth-complete?from=${encodeURIComponent(from)}`;
    signIn("google", { callbackUrl });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid email or password");
        return;
      }
      window.location.href = from;
    } catch {
      setError("Login failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="kids-wrap kids-signin kids-signin-staff-page">
      <section className="kids-signin-welcome">
        <KidsLogo />
        <p className="kids-plain-label">Staff sign-in</p>
        <h1>
          Welcome back, <span>team!</span>
        </h1>
        <p>Look after the programmes, classes, bookings and family enquiries that keep AI Kids running.</p>
        <div className="kids-signin-scene">
          <Image
            src="/images/story-workshop-banner.webp"
            alt="Illustration of a parent and child making a storybook with a workshop teacher"
            fill
            priority
            sizes="(max-width: 900px) 0px, 700px"
          />
          <div className="kids-signin-pip" aria-hidden="true">
            <PipMascot />
          </div>
        </div>
      </section>
      <form onSubmit={onSubmit} className="kids-signin-card space-y-4">
        <h2>Sign in to AI Kids</h2>
        <div>
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-4 py-3 rounded-lg bg-white/3 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
          />
        </div>
        <div>
          <label>Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 rounded-lg bg-white/3 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
              className="flex items-center text-white/50 hover:text-(--color-cyan) transition"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {error && (
          <p className="kids-signin-error" role="alert">{error}</p>
        )}
        {!error && oauthError && (
          <p className="kids-signin-error" role="alert">
            {oauthError === "not-authorized"
              ? "This Google account is not authorised for admin access."
              : "Google sign-in failed — please try again."}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="kids-button w-full disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {googleEnabled && <><div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-sm text-(--color-muted)">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={loading}
          className="kids-signin-google disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23Z" fill="#34A853" />
            <path d="M5.84 14.1A6.62 6.62 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11.002 11.002 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.83Z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button></>}
      </form>
    </div>
  );
}
