/**
 * Frontend utilities for subscription tier checks.
 */

export type AccountTier = "free" | "pro";

export type BillingStatus = {
  accountTier: AccountTier;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

export function isPro(status: BillingStatus | null): boolean {
  if (!status) return false;
  return (
    status.accountTier === "pro" &&
    (status.subscriptionStatus === "active" || status.subscriptionStatus === "trialing")
  );
}

export function isTrialing(status: BillingStatus | null): boolean {
  if (!status) return false;
  return status.subscriptionStatus === "trialing";
}

export function isPastDue(status: BillingStatus | null): boolean {
  if (!status) return false;
  return status.subscriptionStatus === "past_due";
}
