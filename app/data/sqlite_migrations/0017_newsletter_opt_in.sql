-- Add newsletter opt-in flag to profiles
ALTER TABLE profiles ADD COLUMN newsletter_opt_in INTEGER NOT NULL DEFAULT 0;
