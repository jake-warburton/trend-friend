# Ad Intelligence API Key Setup

Each source works independently — set up in any order, skip any you don't need.

---

## 1. Google Ads Transparency (via SerpApi) — Ready now

Already have `SERPAPI_KEY`. No action needed.

**Secrets:** `SERPAPI_KEY` (already configured)

---

## 2. Google Keyword Planner

Uses your existing Google Ads account.

1. **Google Cloud Console** → create a project (or use existing)
2. **APIs & Services → Enable** the Google Ads API
3. **APIs & Services → Credentials → Create OAuth 2.0 Client ID** (Desktop app type)
   - Note the Client ID and Client Secret
4. **Google Ads UI → Tools → API Center** → apply for a developer token
   - Basic access is fine (no need for Standard)
   - Approval is usually instant for basic access
5. **Generate refresh token** — run the google-ads library's auth flow once:
   ```bash
   pip install google-ads
   python -c "from google.ads.googleads.client import GoogleAdsClient; GoogleAdsClient.load_from_storage()"
   ```
   Or use the OAuth playground at https://developers.google.com/oauthplayground
6. **Customer ID** — visible top-right in Google Ads UI (format: 123-456-7890, store without dashes)

**Secrets to add:**
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID`

---

## 3. Meta Ad Library

Free, no spend required.

1. Go to https://developers.facebook.com → **Create App** (Business type)
2. App Dashboard → **Settings → Basic** → note App ID and App Secret
3. Generate a long-lived token: **Graph API Explorer** → select your app → generate User Token → exchange for a long-lived token via:
   ```
   GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}
   ```
   Or use an App Access Token (simpler): `{APP_ID}|{APP_SECRET}`
4. No special review needed — Ad Library API is publicly accessible

**Secrets to add:**
- `META_APP_TOKEN`

---

## 4. TikTok Commercial Content API

Most friction — can defer this one.

1. Register at https://business-api.tiktok.com/ → create a developer account
2. **Create App** → request access to the Commercial Content API
3. Wait for approval (can take days/weeks)
4. Once approved, note the App Key and App Secret from the app dashboard

**Secrets to add:**
- `TIKTOK_ADS_CLIENT_KEY`
- `TIKTOK_ADS_CLIENT_SECRET`

---

## Suggested order

1. SerpApi — already done
2. Meta Ad Library — 10 minutes, free
3. Google Keyword Planner — 30 minutes, uses existing account
4. TikTok — apply and wait, lowest priority
