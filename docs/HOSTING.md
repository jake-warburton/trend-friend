# Hosting Trend Friend

This project is currently split naturally into:

- Vercel-hosted Next.js frontend
- Python FastAPI backend
- persistent database
- scheduled refresh job

## Recommended deployment shape

Use:

- **Vercel** for `web/`
- **Railway** or **Render** for the Python API
- **Postgres** for long-term persistence

SQLite is acceptable only as a temporary hosted step if your platform provides a persistent disk. It is not the right final production database for a multi-instance deployment.

## Backend deployment

The backend can be deployed from the repo root using the included `Dockerfile`.

Container entrypoint:

```bash
uvicorn app.api.main:app --host 0.0.0.0 --port 8000
```

Health check:

```text
/api/v1/health
```

## Render quick start

This repo now includes [render.yaml](/Users/jakewarburton/Documents/repos/trend-friend/render.yaml).

To deploy:

1. Create a new Render Blueprint from the repo.
2. Render will create the `trend-friend-api` web service from `render.yaml`.
3. Fill in the non-synced environment variables in the Render dashboard:
   - `TREND_FRIEND_REDDIT_USER_AGENT`
   - `GITHUB_TOKEN` if you want higher GitHub rate limits
   - `TWITTER_BEARER_TOKEN` if you want live Twitter/X ingestion
4. Copy the generated `TREND_FRIEND_REFRESH_SECRET`.
5. Set the same `TREND_FRIEND_REFRESH_SECRET` in Vercel.
6. Set `TREND_FRIEND_API_URL` in Vercel to the Render API URL.

The included Render blueprint currently uses:

- a Docker web service
- a 1 GB persistent disk mounted at `/data`
- SQLite stored at `/data/trend_friend.db`
- CORS preconfigured for `https://trend-friend-zeta.vercel.app`

This is acceptable as a first hosted step. The next production step is still migrating to Postgres.

## Required backend environment variables

- `TREND_FRIEND_DATABASE_PATH`
- `TREND_FRIEND_REDDIT_USER_AGENT`
- `TREND_FRIEND_CORS_ORIGINS`

## Recommended backend environment variables

- `TREND_FRIEND_REFRESH_SECRET`
- `GITHUB_TOKEN`
- `TWITTER_BEARER_TOKEN`
- `TREND_FRIEND_REQUEST_TIMEOUT_SECONDS`
- `TREND_FRIEND_MAX_ITEMS_PER_SOURCE`
- `TREND_FRIEND_RANKING_LIMIT`

Example hosted values:

```bash
TREND_FRIEND_DATABASE_PATH=/data/trend_friend.db
TREND_FRIEND_CORS_ORIGINS=https://trend-friend-zeta.vercel.app
TREND_FRIEND_REFRESH_SECRET=replace-me
TREND_FRIEND_REDDIT_USER_AGENT=trend-friend-production/1.0
```

## Frontend environment variables on Vercel

Set:

```bash
TREND_FRIEND_API_URL=https://your-api-host.example.com
TREND_FRIEND_REFRESH_SECRET=replace-me
CRON_SECRET=replace-with-a-separate-secret
```

The refresh secret must match the backend secret. The Next.js server route forwards it to `POST /api/v1/refresh`.
`CRON_SECRET` is used by Vercel to authorize calls into the cron route.

## Scheduled refresh

Run the equivalent of:

```text
POST /api/v1/refresh
```

with this header:

```text
X-Trend-Friend-Refresh-Secret: <TREND_FRIEND_REFRESH_SECRET>
```

Recommended schedule:

- every 30 minutes

This can be triggered by:

- a scheduler in Railway/Render
- or Vercel Cron calling the backend refresh endpoint

This repo now includes [vercel.json](/Users/jakewarburton/Documents/repos/trend-friend/vercel.json) and a cron route at [web/app/api/cron/refresh/route.ts](/Users/jakewarburton/Documents/repos/trend-friend/web/app/api/cron/refresh/route.ts).

The default schedule is:

- `0 6 * * *` (once daily at 06:00 UTC)

That default is conservative so it is less likely to conflict with lower-tier Vercel limits.

If you are on a plan that supports more frequent cron jobs, change the schedule in `vercel.json` to something like:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

## Rollout order

1. Deploy the Python API with persistent storage.
2. Set `TREND_FRIEND_API_URL` on Vercel.
3. Set matching `TREND_FRIEND_REFRESH_SECRET` on both backend and Vercel.
4. Add a scheduled `POST /api/v1/refresh` job.
5. Migrate from SQLite to Postgres.

## Next step after backend deployment

Replace SQLite with Postgres. That is the real production milestone for persistence and multi-instance safety.

The staged migration plan is documented in [docs/POSTGRES_MIGRATION.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/POSTGRES_MIGRATION.md).
