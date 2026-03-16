"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function LogoutButton() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) {
    return <p className="detail-copy">You are not signed in.</p>;
  }

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
