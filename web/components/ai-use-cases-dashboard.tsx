"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { AiUseCasesContent } from "@/components/ai-use-cases-content";
import { useProfile } from "@/components/profile-provider";
import type { AiUseCaseIntelligence } from "@/lib/ai-use-cases";
import { useScreenshotMode } from "@/lib/use-screenshot-mode";

export function canAccessAiUseCasesDashboard({
  isScreenshot,
  isPro,
  authLoading,
  profileLoading,
}: {
  isScreenshot: boolean;
  isPro: boolean;
  authLoading: boolean;
  profileLoading: boolean;
}) {
  return isScreenshot || (isPro && !authLoading && !profileLoading);
}

function AiUseCasesSkeleton() {
  return (
    <div className="detail-page ai-use-cases-page">
      <div className="detail-hero ai-use-cases-hero">
        <div>
          <div className="skeleton-pulse" style={{ width: 120, height: 16, borderRadius: 999 }} />
          <div className="skeleton-pulse" style={{ width: 240, height: 40, borderRadius: 12, marginTop: 16 }} />
          <div className="skeleton-pulse" style={{ width: "100%", maxWidth: 560, height: 72, borderRadius: 12, marginTop: 16 }} />
        </div>
      </div>
      <div className="skeleton-pulse" style={{ width: "100%", height: 420, borderRadius: 24, marginTop: 24 }} />
    </div>
  );
}

export function AiUseCasesDashboard() {
  const { loading: authLoading } = useAuth();
  const { isPro, loading: profileLoading } = useProfile();
  const isScreenshot = useScreenshotMode();
  const [data, setData] = useState<AiUseCaseIntelligence | null>(null);
  const [hasError, setHasError] = useState(false);

  const shouldShow = canAccessAiUseCasesDashboard({
    isScreenshot,
    isPro,
    authLoading,
    profileLoading,
  });

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    let cancelled = false;
    fetch("/api/ai-use-cases")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AiUseCaseIntelligence | null) => {
        if (cancelled) {
          return;
        }

        setData(payload);
        setHasError(payload === null);
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  if (!data) {
    return (
      <>
        <style>{`.ai-use-cases-teaser { display: none !important; }`}</style>
        {hasError ? (
          <main className="detail-page ai-use-cases-page">
            <section className="adi-gate" style={{ marginTop: 32 }}>
              <div className="adi-gate-inner">
                <div className="adi-gate-badge">Data unavailable</div>
                <p className="adi-gate-copy">
                  The AI use-case dataset could not be loaded right now.
                </p>
              </div>
            </section>
          </main>
        ) : (
          <AiUseCasesSkeleton />
        )}
      </>
    );
  }

  return (
    <>
      <style>{`.ai-use-cases-teaser { display: none !important; }`}</style>
      <main className="detail-page ai-use-cases-page">
        <AiUseCasesContent intelligence={data} />
      </main>
    </>
  );
}
