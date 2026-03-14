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
  const [accountTier, setAccountTier] = useState<AccountTier>("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountTier("free");
      setIsAdmin(false);
      setSubscriptionStatus("none");
      setLoading(false);
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
        setLoading(false);
      });
  }, [user]);

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
