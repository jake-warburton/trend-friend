"use client";

import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth-provider";

type LogoutButtonInnerProps = {
  user: User;
  signOut: () => Promise<void>;
};

function LogoutButtonInner({ user, signOut }: LogoutButtonInnerProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/explore");
  };

  return (
    <div>
      <p className="detail-copy" style={{ marginBottom: 12 }}>
        Signed in as <strong>{user.user_metadata?.full_name || user.email}</strong>
      </p>
      <button className="auth-submit-button" onClick={handleLogout} type="button">
        Sign out
      </button>
    </div>
  );
}

export function LogoutButton() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <p className="detail-copy">You are not signed in.</p>;
  }

  return <LogoutButtonInner user={user} signOut={signOut} />;
}
