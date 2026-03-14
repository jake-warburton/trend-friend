-- Profiles table (SQLite variant — no auth.users FK, no RLS)
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    username TEXT UNIQUE,
    is_admin INTEGER NOT NULL DEFAULT 0,
    account_tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'none',
    current_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bridge column on existing users table for migration
ALTER TABLE users ADD COLUMN supabase_uid TEXT UNIQUE;
