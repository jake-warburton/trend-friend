-- ============================================================
-- 0016: Enable Row Level Security on all tables
--
-- Python backend connects via psycopg (direct Postgres connection)
-- and is unaffected by RLS. These policies restrict access through
-- Supabase's PostgREST (anon key) used by the Next.js frontend.
-- ============================================================

-- ── Helper: resolve the legacy users.id for the current auth.uid() ──

CREATE OR REPLACE FUNCTION public.current_legacy_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 1. Backend-only tables: enable RLS, no policies → deny all
--    via anon key. Python bypasses RLS entirely.
-- ============================================================

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_curation_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_family_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. published_payloads: public read via anon key, no write
-- ============================================================

ALTER TABLE published_payloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published payloads"
  ON published_payloads FOR SELECT
  USING (true);

-- ============================================================
-- 3. profiles: already has RLS from 0014 (no changes needed)
-- ============================================================

-- ============================================================
-- 4. Watchlists: owner-only via legacy user ID lookup
-- ============================================================

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own watchlists"
  ON watchlists FOR SELECT
  USING (owner_user_id = public.current_legacy_user_id());

CREATE POLICY "Owners can insert own watchlists"
  ON watchlists FOR INSERT
  WITH CHECK (owner_user_id = public.current_legacy_user_id());

CREATE POLICY "Owners can update own watchlists"
  ON watchlists FOR UPDATE
  USING (owner_user_id = public.current_legacy_user_id());

CREATE POLICY "Owners can delete own watchlists"
  ON watchlists FOR DELETE
  USING (owner_user_id = public.current_legacy_user_id());

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own watchlist items"
  ON watchlist_items FOR SELECT
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

CREATE POLICY "Owners can insert own watchlist items"
  ON watchlist_items FOR INSERT
  WITH CHECK (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

CREATE POLICY "Owners can update own watchlist items"
  ON watchlist_items FOR UPDATE
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

CREATE POLICY "Owners can delete own watchlist items"
  ON watchlist_items FOR DELETE
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

-- ── Watchlist shares: owner access + public shares readable ──

ALTER TABLE watchlist_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own watchlist shares"
  ON watchlist_shares FOR ALL
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

CREATE POLICY "Public shares are readable by anyone"
  ON watchlist_shares FOR SELECT
  USING (is_public = 1);

ALTER TABLE watchlist_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own share events"
  ON watchlist_share_events FOR SELECT
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

ALTER TABLE watchlist_share_daily_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own share access stats"
  ON watchlist_share_daily_access FOR SELECT
  USING (share_id IN (
    SELECT ws.id FROM watchlist_shares ws
    JOIN watchlists w ON w.id = ws.watchlist_id
    WHERE w.owner_user_id = public.current_legacy_user_id()
  ));

-- ============================================================
-- 5. Alerts: owner-only via watchlist ownership
-- ============================================================

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own alert rules"
  ON alert_rules FOR ALL
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own alert events"
  ON alert_events FOR SELECT
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

-- ============================================================
-- 6. Theses: owner-only via watchlist ownership
-- ============================================================

ALTER TABLE trend_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own theses"
  ON trend_theses FOR ALL
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE owner_user_id = public.current_legacy_user_id()
  ));

ALTER TABLE trend_thesis_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own thesis matches"
  ON trend_thesis_matches FOR SELECT
  USING (thesis_id IN (
    SELECT t.id FROM trend_theses t
    JOIN watchlists w ON w.id = t.watchlist_id
    WHERE w.owner_user_id = public.current_legacy_user_id()
  ));

-- ============================================================
-- 7. Notification channels & log: owner-only
-- ============================================================

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own notification channels"
  ON notification_channels FOR ALL
  USING (owner_user_id = public.current_legacy_user_id());

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own notification log"
  ON notification_log FOR SELECT
  USING (channel_id IN (
    SELECT id FROM notification_channels
    WHERE owner_user_id = public.current_legacy_user_id()
  ));

-- ============================================================
-- 8. API keys & sessions: owner-only
-- ============================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own API keys"
  ON api_keys FOR ALL
  USING (user_id = public.current_legacy_user_id());

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own sessions"
  ON user_sessions FOR ALL
  USING (user_id = public.current_legacy_user_id());
