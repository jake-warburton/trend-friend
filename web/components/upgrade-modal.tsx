"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useProfile } from "@/components/profile-provider";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  feature?: string;
};

export function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const handleUpgrade = async () => {
    if (!user) {
      window.location.href = "/login?next=/pricing";
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch {
      window.location.href = "/pricing";
    } finally {
      setActionLoading(false);
    }
  };

  const featureLabel = feature ?? "This feature";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="upgrade-modal"
    >
      <div className="upgrade-modal-header">
        <span className="upgrade-modal-badge">PRO</span>
        <h3 className="upgrade-modal-title">
          {featureLabel} requires a Pro plan
        </h3>
      </div>
      <p className="upgrade-modal-desc">
        Upgrade to unlock CSV export, ad intelligence, email alerts, watchlists, and more.
      </p>
      <div className="upgrade-modal-price">
        <span className="upgrade-modal-amount">$5.99</span>
        <span className="upgrade-modal-period">/ month</span>
      </div>
      <div className="upgrade-modal-actions">
        <button
          type="button"
          className="upgrade-modal-cancel"
          onClick={onClose}
          disabled={actionLoading}
        >
          Maybe later
        </button>
        <button
          type="button"
          className="upgrade-modal-cta"
          onClick={handleUpgrade}
          disabled={actionLoading}
        >
          {actionLoading ? "Loading..." : user ? "Upgrade to Pro" : "Sign in to upgrade"}
        </button>
      </div>
    </dialog>
  );
}

export function useUpgradeGate() {
  const { user } = useAuth();
  const { isPro, loading } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  const requirePro = (callback?: () => void) => {
    if (loading) return;
    if (user && isPro) {
      callback?.();
      return;
    }
    setModalOpen(true);
  };

  return {
    modalOpen,
    closeModal: () => setModalOpen(false),
    requirePro,
    isPro: !!user && isPro,
  };
}
