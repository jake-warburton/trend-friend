# Hosting Signal Eye

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

## Free option: Vercel + GitHub Actions

If you want to avoid paying for backend hosting, the simplest free path is:

- Vercel for the frontend
- GitHub Actions for scheduled ingestion and export
- generated snapshots committed back into the repo

This repo includes [refresh-data.yml](/Users/jakewarburton/Documents/repos/signal-eye/.github/workflows/refresh-data.yml), which:

1. runs `python3 scripts/run_ingestion.py`
2. runs `python3 scripts/export_web_data.py`
3. persists `data/signal_eye.db` so historical state survives between runs
4. force-adds the generated database and `web/data` files
5. commits and pushes the updated snapshots back to the repository

For this setup:

- leave `SIGNAL_EYE_API_URL` unset on Vercel
- let the Next.js app read `web/data/*.json`
- configure GitHub repository secrets for any optional tokens

Default workflow cadence:

- every 15 minutes

That is a practical compromise between freshness and repository churn.

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

This repo now includes [render.yaml](/Users/jakewarburton/Documents/repos/signal-eye/render.yaml).

To deploy:

1. Create a new Render Blueprint from the repo.
2. Render will create the `signal-eye-api` web service from `render.yaml`.
3. Fill in the non-synced environment variables in the Render dashboard:
   - `SIGNAL_EYE_REDDIT_USER_AGENT`
   - `GITHUB_TOKEN` if you want higher GitHub rate limits
   - `TWITTER_BEARER_TOKEN` if you want live Twitter/X ingestion
4. Copy the generated `SIGNAL_EYE_REFRESH_SECRET`.
5. Set the same `SIGNAL_EYE_REFRESH_SECRET` in Vercel.
6. Set `SIGNAL_EYE_API_URL` in Vercel to the Render API URL.

The included Render blueprint currently uses:

- a Docker web service
- a 1 GB persistent disk mounted at `/data`
- SQLite stored at `/data/signal_eye.db`
- CORS preconfigured for `https://signal-eye-zeta.vercel.app`

This is acceptable as a first hosted step. The next production step is still migrating to Postgres.

## Required backend environment variables

- `SIGNAL_EYE_DATABASE_PATH`
- `SIGNAL_EYE_REDDIT_USER_AGENT`
- `SIGNAL_EYE_CORS_ORIGINS`

## Recommended backend environment variables

- `SIGNAL_EYE_REFRESH_SECRET`
- `GITHUB_TOKEN`
- `TWITTER_BEARER_TOKEN`
- `SIGNAL_EYE_REQUEST_TIMEOUT_SECONDS`
- `SIGNAL_EYE_MAX_ITEMS_PER_SOURCE`
- `SIGNAL_EYE_RANKING_LIMIT`

Example hosted values:

```bash
SIGNAL_EYE_DATABASE_PATH=/data/signal_eye.db
SIGNAL_EYE_CORS_ORIGINS=https://signal-eye-zeta.vercel.app
SIGNAL_EYE_REFRESH_SECRET=replace-me
SIGNAL_EYE_REDDIT_USER_AGENT=signal-eye-production/1.0
```

## Frontend environment variables on Vercel

Set:

```bash
SIGNAL_EYE_API_URL=https://your-api-host.example.com
SIGNAL_EYE_REFRESH_SECRET=replace-me
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
X-Trend-Friend-Refresh-Secret: <SIGNAL_EYE_REFRESH_SECRET>
```

Recommended schedule:

- every 30 minutes

This can be triggered by:

- a scheduler in Railway/Render
- or Vercel Cron calling the backend refresh endpoint

This repo now includes [vercel.json](/Users/jakewarburton/Documents/repos/signal-eye/vercel.json) and a cron route at [web/app/api/cron/refresh/route.ts](/Users/jakewarburton/Documents/repos/signal-eye/web/app/api/cron/refresh/route.ts).

The default schedule is:

- `*/5 * * * *` (every 5 minutes)

If you need to reduce invocation frequency later, change the schedule in `vercel.json` to something like:

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
2. Set `SIGNAL_EYE_API_URL` on Vercel.
3. Set matching `SIGNAL_EYE_REFRESH_SECRET` on both backend and Vercel.
4. Add a scheduled `POST /api/v1/refresh` job.
5. Migrate from SQLite to Postgres.

## Next step after backend deployment

Replace SQLite with Postgres. That is the real production milestone for persistence and multi-instance safety.

The staged migration plan is documented in [docs/POSTGRES_MIGRATION.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/POSTGRES_MIGRATION.md).
