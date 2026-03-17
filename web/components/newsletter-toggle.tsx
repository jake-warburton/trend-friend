"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function NewsletterToggle() {
  const [optedIn, setOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("profiles")
          .select("newsletter_opt_in")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            setOptedIn(profile?.newsletter_opt_in ?? false);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleToggle = async () => {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const newValue = !optedIn;
    await supabase
      .from("profiles")
      .update({ newsletter_opt_in: newValue })
      .eq("id", user.id);
    setOptedIn(newValue);
    setSaving(false);
  };

  if (loading) {
    return <div className="skeleton-pulse" style={{ width: 200, height: 20, borderRadius: 4 }} />;
  }

  return (
    <label className="auth-checkbox-label" style={{ cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={optedIn}
        onChange={handleToggle}
        disabled={saving}
        className="auth-checkbox"
      />
      <span>
        Subscribe to our newsletter to get notified when new features are available
        {saving && " ..."}
      </span>
    </label>
  );
}
