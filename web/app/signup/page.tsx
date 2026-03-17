"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName || undefined,
          newsletter_opt_in: newsletterOptIn,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If session returned, signup is complete — redirect
    if (data.session) {
      router.push("/explore");
      return;
    }

    // No session — try signing in directly (handles case where confirmation is disabled
    // but Supabase didn't return a session, or user already exists)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      router.push("/explore");
      return;
    }

    setError("Account created. Please check your email to confirm, then sign in.");
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
          <h1 className="auth-brand-title">Create account</h1>
          <p className="auth-brand-subtitle">
            Save watchlists, set alerts, and unlock premium features.
          </p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-oauth-button" onClick={handleGoogleSignup} type="button">
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
          <span>or sign up with email</span>
        </div>

        <form onSubmit={handleEmailSignup} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-name">Display name</label>
            <input
              id="signup-name"
              className="auth-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              placeholder="How you'd like to be called"
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
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
            <label className="auth-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <label className="auth-checkbox-label">
            <input
              type="checkbox"
              checked={newsletterOptIn}
              onChange={(e) => setNewsletterOptIn(e.target.checked)}
              className="auth-checkbox"
            />
            <span>Subscribe to our newsletter to get notified when new features are available</span>
          </label>
          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? "Creating account\u2026" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
