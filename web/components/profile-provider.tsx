"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AccountTier } from "@/lib/subscription";

type ProfileContextValue = {
  accountTier: AccountTier;
  isAdmin: boolean;
  isPro: boolean;
  isOwner: boolean;
  loading: boolean;
};

const ProfileContext = createContext<ProfileContextValue>({
  accountTier: "free",
  isAdmin: false,
  isPro: false,
  isOwner: false,
  loading: true,
});

export function useProfile() {
  return useContext(ProfileContext);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);
  const [accountTier, setAccountTier] = useState<AccountTier>("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");

  useEffect(() => {
    if (!user) {
      setFetchedForUserId(null);
      setAccountTier("free");
      setIsAdmin(false);
      setSubscriptionStatus("none");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("is_admin, account_tier, subscription_status")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsAdmin(data.is_admin ?? false);
          setAccountTier(data.account_tier === "pro" ? "pro" : "free");
          setSubscriptionStatus(data.subscription_status ?? "none");
        }
        setFetchedForUserId(user.id);
      });
  }, [user]);

  // Derived synchronously: loading is true whenever the profile hasn't been
  // fetched for the current user yet. This avoids the one-frame gap where
  // useEffect hasn't fired but the user has already changed.
  const loading = user ? fetchedForUserId !== user.id : false;

  const isPro =
    isAdmin ||
    (accountTier === "pro" &&
      (subscriptionStatus === "active" || subscriptionStatus === "trialing"));
  const isOwner = isAdmin;

  return (
    <ProfileContext.Provider
      value={{ accountTier, isAdmin, isPro, isOwner, loading }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
