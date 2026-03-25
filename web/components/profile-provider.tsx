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
  const { authEnabled, user } = useAuth();
  const [profileState, setProfileState] = useState({
    fetchedForUserId: null as string | null,
    accountTier: "free" as AccountTier,
    isAdmin: false,
    subscriptionStatus: "none",
  });

  useEffect(() => {
    if (!authEnabled || !user) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("is_admin, account_tier, subscription_status")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setProfileState({
          fetchedForUserId: user.id,
          isAdmin: data?.is_admin ?? false,
          accountTier: data?.account_tier === "pro" ? "pro" : "free",
          subscriptionStatus: data?.subscription_status ?? "none",
        });
      });
  }, [authEnabled, user]);

  const accountTier =
    authEnabled && user && profileState.fetchedForUserId === user.id
      ? profileState.accountTier
      : "free";
  const isAdmin =
    authEnabled && user && profileState.fetchedForUserId === user.id
      ? profileState.isAdmin
      : false;
  const subscriptionStatus =
    authEnabled && user && profileState.fetchedForUserId === user.id
      ? profileState.subscriptionStatus
      : "none";

  // Derived synchronously: loading is true whenever the profile hasn't been
  // fetched for the current user yet. This avoids the one-frame gap where
  // useEffect hasn't fired but the user has already changed.
  const loading =
    authEnabled && user ? profileState.fetchedForUserId !== user.id : false;

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
