# Adding the server-side proxy (hides your Twelve Data key)

## Files here

- `api/forex-candles.js` — new. Vercel serverless function that holds your
  Twelve Data key and proxies requests.
- `src/lib/dataFeeds.js` — replaces your existing file. Forex/commodities
  now call `/api/forex-candles` instead of Twelve Data directly.
- `src/components/ScannerDashboard.jsx` — replaces your existing file. The
  API key input field is gone; scanning just works.

## Setup steps

1. Add `api/forex-candles.js` to your repo **at the root** (a top-level
   `api/` folder, not inside `src/`) — this is the exact convention Vercel
   looks for to auto-create a serverless function.
2. Replace `src/lib/dataFeeds.js` and `src/components/ScannerDashboard.jsx`
   with the versions here.
3. In your Vercel dashboard: **Project → Settings → Environment Variables**,
   add:
   - Key: `TWELVE_DATA_API_KEY`
   - Value: your actual Twelve Data API key
   - Environment: Production (and Preview if you want previews to work too)
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy, or just push a commit).

Your key now lives only on Vercel's servers — it's never sent to, or
visible from, anyone's browser.

## One thing this changes about your economics

Every visitor's scan now spends *your* Twelve Data credits, not their own.
The proxy caches each symbol's data for 60 seconds server-side, so multiple
users scanning around the same time share one upstream fetch instead of
each burning a separate credit — this is what makes one shared key
sustainable across several subscribers. But it's still a shared, finite
pool: on the free tier (800 calls/day) this will run out fast with real
users. Once you have paying subscribers, this is the moment the ~$149/mo
Business "Venture" plan becomes a real cost of doing business, not
optional — budget it into your subscription price.

## Suggested next safeguard

Right now `runScan` is callable by anyone who loads the page, unlimited
times. Once you have paying users, you'll want to gate `/api/forex-candles`
behind your Supabase auth (check the user has an active subscription
before proxying the request) — otherwise a non-paying visitor could hit
"Run scan" repeatedly and drain your shared credit pool. Happy to build
that check next if you want it now.
