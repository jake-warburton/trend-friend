"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function AuthUnavailableCard() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1 className="auth-brand-title">Sign in unavailable</h1>
          <p className="auth-brand-subtitle">
            This environment does not have Supabase auth configured.
          </p>
        </div>
        <p className="auth-error">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to enable sign in.
        </p>
        <p className="auth-switch">
          <Link href="/explore">Return to explorer</Link>
        </p>
      </div>
    </main>
  );
}

function LoginForm() {
  const authEnabled = isSupabaseConfigured();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/explore";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!authEnabled) {
    return <AuthUnavailableCard />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
    });
    if (authError) {
      setError(authError.message);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 256 256" fill="none">
              <g stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
                <path d="M36 82C88 38 168 38 220 82" strokeWidth="22" />
                <path d="M62 118C104 82 152 82 194 118" strokeWidth="22" />
                <path d="M90 150C114 130 142 130 166 150" strokeWidth="22" />
                <circle cx="128" cy="186" r="20" fill="currentColor" />
                <line x1="143" y1="201" x2="172" y2="230" />
              </g>
            </svg>
          </div>
          <h1 className="auth-brand-title">Sign in</h1>
          <p className="auth-brand-subtitle">
            Access your watchlists, alerts, and premium features.
          </p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-oauth-button" onClick={handleGoogleLogin} type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleEmailLogin} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>
          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
