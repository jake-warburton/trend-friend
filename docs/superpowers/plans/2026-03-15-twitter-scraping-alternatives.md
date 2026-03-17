# Twitter/X Scraping Alternatives

**Date:** 2026-03-15
**Status:** Recommendation ready, code updated

## Problem

Both `twscrape` and `twikit` fail with Cloudflare 403 blocks when calling
their **login** endpoints against x.com. This happens from all environments
(local IP 103.214.47.92, GitHub Actions runners). The Twitter API free tier
provides no read access.

## Research Findings

### 1. twikit with pre-exported cookies -- WORKS

**Verdict: Recommended. Code updated.**

The Cloudflare 403 only blocks the **login flow** (the POST to
`api.twitter.com/1.1/onboarding/task.json`). Data-fetching GraphQL
endpoints work fine with valid session cookies.

Tested:
- `twikit.Client.set_cookies({"auth_token": "...", "ct0": "..."})` accepts
  cookies without making any network call.
- With no cookies: `403 Forbidden` (Cloudflare).
- With fake cookies: `401 Unauthorized` (Twitter rejecting bad auth -- but
  Cloudflare let the request through).
- Conclusion: **valid cookies bypass Cloudflare entirely**.

Workflow:
1. Log in to x.com as @SignalEyeFetch in any browser.
2. Open DevTools -> Application -> Cookies -> `https://x.com`.
3. Copy the `auth_token` and `ct0` cookie values.
4. Store as GitHub secret: `TWITTER_COOKIES_JSON='{"auth_token":"...","ct0":"..."}'`
5. Cookies are long-lived (~1 year for `auth_token`) but must be refreshed
   if the session is invalidated (password change, suspicious activity).

### 2. Twitter guest tokens -- PARTIAL

Guest token activation (`POST api.twitter.com/1.1/guest/activate.json`)
still works and returns valid tokens. The `UserByScreenName` GraphQL
endpoint responds to guest-token requests. However, `UserTweets` and search
endpoints return 404 for guest tokens -- Twitter has locked down tweet
content behind authenticated sessions.

**Not viable for tweet scraping.**

### 3. Twitter syndication / embed API -- RATE LIMITED

- `syndication.twitter.com/srv/timeline-profile/screen-name/{handle}`:
  Returns 429 (rate limit exceeded) immediately.
- `cdn.syndication.twimg.com/tweet-result?id={id}`: Returns error pages.
- `publish.twitter.com/oembed`: Returns embed HTML but no tweet content
  (just a JS widget loader).

**Not viable.**

### 4. Nitter instances -- DEAD

Tested five Nitter instances:
- `nitter.net`: Returns 200 but empty body (instance is non-functional).
- `nitter.poast.org`: 403 Forbidden.
- `nitter.privacydev.net`, `nitter.woodland.cafe`: Connection refused.

All public Nitter instances are effectively dead since Twitter locked down
their guest API in mid-2025.

**Not viable.**

### 5. RSS bridges (RSSHub, twiiit.com) -- DEAD

- `rsshub.app/twitter/user/{handle}`: Redirects to Google 404.
- `twiiit.com/{handle}/rss`: Redirects away.

These services relied on Nitter or guest tokens, both of which are defunct.

**Not viable.**

### 6. browser_cookie3 for automated cookie extraction -- LIMITED

The `browser_cookie3` library can extract cookies from Chrome, Firefox, and
Safari. In testing, Firefox had some Twitter cookies (`guest_id`,
`__cf_bm`, `_twitter_sess`) but **not** `auth_token` or `ct0` because the
@SignalEyeFetch account was not logged in. If the account were logged in,
this would work for local runs but not in GitHub Actions (no browser).

**Useful for local dev only.** Not a CI solution.

### 7. Playwright/Selenium headless login -- NOT TESTED

Could potentially bypass Cloudflare by running a real browser. However:
- Adds heavy dependencies (Playwright ~150MB).
- Cloudflare's bot detection increasingly catches headless browsers.
- GitHub Actions would need browser installation steps.
- Cookie-based approach is simpler and already works.

**Defer unless cookies become unreliable.**

## Recommendation

**Use twikit with pre-exported browser cookies** (option 1).

This is already implemented in `app/sources/twitter_scraper.py`. The
scraper now:
1. Checks for `TWITTER_COOKIES_JSON` env var first (twikit + cookies).
2. Falls back to `TWITTER_SCRAPE_ACCOUNTS` (twscrape + login) if cookies
   are not set.

### Setup Steps

1. Log in to x.com as @SignalEyeFetch in a browser.
2. Extract `auth_token` and `ct0` from browser cookies.
3. Add GitHub secret:
   ```
   TWITTER_COOKIES_JSON={"auth_token":"abc123...","ct0":"def456..."}
   ```
4. The workflow already passes this secret to the job environment.

### Maintenance

- **Cookie expiry:** `auth_token` typically lasts ~1 year. `ct0` rotates
  but twikit auto-updates it in-session. If scraping starts failing with
  401 errors, re-export cookies from the browser.
- **Rate limits:** Twitter rate-limits authenticated users to ~500
  requests per 15 minutes. With ~35 accounts at 2 requests each (user
  lookup + tweets), each run uses ~70 requests. The 15-minute cron is safe.
- **Account risk:** The @SignalEyeFetch account could be suspended for
  automated access. Use conservative rate limiting and avoid actions that
  look bot-like (no writes, no rapid-fire requests).

### Future Improvements

- Add a cookie health-check step to the workflow that tests one API call
  before processing all accounts, and sends an alert if cookies are expired.
- Consider a small Cloudflare Worker or self-hosted proxy that performs the
  login flow (Cloudflare Workers can bypass Cloudflare challenges since
  they run inside the Cloudflare network) and exports fresh cookies.
- Monitor the Twitter API landscape -- paid tiers may become more
  accessible or new scraping libraries may emerge.
