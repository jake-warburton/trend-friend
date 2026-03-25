"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { isPro, type BillingStatus } from "@/lib/subscription";

export function SubscriptionManager() {
  const { authEnabled, user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(authEnabled);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!authEnabled || !user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch("/api/billing/status");
        if (res.ok) setStatus(await res.json());
      } catch {
        // billing unavailable
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authEnabled, user]);

  useEffect(() => {
    if (showCancelModal) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [showCancelModal]);

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (res.ok) {
        setStatus((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      }
    } catch {
      // handle error
    } finally {
      setActionLoading(false);
      setShowCancelModal(false);
    }
  };

  const handleResubscribe = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/resubscribe", { method: "POST" });
      if (res.ok) {
        setStatus((prev) => prev ? { ...prev, cancelAtPeriodEnd: false } : prev);
      }
    } catch {
      // handle error
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="detail-copy">Loading subscription info...</p>;
  }

  if (!authEnabled) {
    return <p className="detail-copy">Billing is unavailable until Supabase auth is configured.</p>;
  }

  if (!user) {
    return <p className="detail-copy">Sign in to manage your subscription.</p>;
  }

  const pro = isPro(status);
  const canceling = status?.cancelAtPeriodEnd;
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  if (!pro) {
    return (
      <div>
        <p className="detail-copy" style={{ marginBottom: 12 }}>
          You are on the <strong>Free</strong> plan.
        </p>
        <a className="auth-submit-button" href="/pricing" style={{ textDecoration: "none", display: "inline-block" }}>
          Upgrade to Pro
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="detail-copy" style={{ marginBottom: 12 }}>
        You are on the <strong>Pro</strong> plan.
        {canceling && periodEnd && (
          <> Your subscription will end on <strong>{periodEnd}</strong>. You have full access until then.</>
        )}
        {!canceling && periodEnd && (
          <> Renews on <strong>{periodEnd}</strong>.</>
        )}
      </p>

      {canceling ? (
        <button
          className="auth-submit-button"
          onClick={handleResubscribe}
          disabled={actionLoading}
          type="button"
        >
          {actionLoading ? "Reactivating..." : "Resubscribe to Pro"}
        </button>
      ) : (
        <button
          className="auth-submit-button"
          onClick={() => setShowCancelModal(true)}
          disabled={actionLoading}
          type="button"
          style={{ background: "var(--color-danger, #dc2626)" }}
        >
          Cancel subscription
        </button>
      )}

      {/* Cancel confirmation modal */}
      <dialog
        ref={dialogRef}
        onClose={() => setShowCancelModal(false)}
        style={{
          border: "none",
          borderRadius: "var(--radius-sm, 8px)",
          padding: "2rem",
          maxWidth: 420,
          width: "90vw",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.2)",
          background: "var(--card-bg, #fff)",
          color: "var(--fg, #1a1a1a)",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "var(--type-size-lg, 1.25rem)" }}>
          Cancel your Pro subscription?
        </h3>
        <p style={{ margin: "0 0 1.5rem", lineHeight: 1.5, opacity: 0.8 }}>
          You will keep full Pro access until <strong>{periodEnd ?? "the end of your billing period"}</strong>.
          After that, your account will revert to the Free plan.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setShowCancelModal(false)}
            disabled={actionLoading}
            style={{
              padding: "0.6rem 1.25rem",
              border: "1px solid var(--border, #ddd)",
              borderRadius: "var(--radius-sm, 6px)",
              background: "transparent",
              color: "var(--fg, #1a1a1a)",
              cursor: "pointer",
              fontSize: "var(--type-size-md, 0.95rem)",
              fontWeight: 500,
            }}
          >
            Keep Pro
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={actionLoading}
            style={{
              padding: "0.6rem 1.25rem",
              border: "none",
              borderRadius: "var(--radius-sm, 6px)",
              background: "var(--color-danger, #dc2626)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "var(--type-size-md, 0.95rem)",
              fontWeight: 600,
            }}
          >
            {actionLoading ? "Canceling..." : "Yes, cancel"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
