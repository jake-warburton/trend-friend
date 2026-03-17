-- ============================================================
-- 0018: Restrict profiles UPDATE policy to safe columns only
--
-- The original UPDATE policy allows users to modify ANY column
-- on their own row, including is_admin, account_tier, and
-- subscription fields. This migration replaces it with a policy
-- that only permits changes to display_name, username, and
-- newsletter_opt_in. All billing/admin fields must be updated
-- via the service role key (Stripe webhooks) or direct DB access.
-- ============================================================

-- Drop the permissive policy from 0014
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Replacement: users may only change display_name, username, and newsletter_opt_in.
-- All other columns must remain unchanged.
CREATE POLICY "Users can update own safe fields" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
    AND account_tier IS NOT DISTINCT FROM (SELECT p.account_tier FROM profiles p WHERE p.id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM profiles p WHERE p.id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM profiles p WHERE p.id = auth.uid())
    AND subscription_status IS NOT DISTINCT FROM (SELECT p.subscription_status FROM profiles p WHERE p.id = auth.uid())
    AND current_period_end IS NOT DISTINCT FROM (SELECT p.current_period_end FROM profiles p WHERE p.id = auth.uid())
  );
