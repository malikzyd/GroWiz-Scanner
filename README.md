standard SMC/ICT structure detection:
order blocks, fair value gaps, liquidity pools (labeled BRM/SRM), and session
kill zones.
Setup
Drop src/lib/pairs.js, src/lib/dataFeeds.js, src/lib/smcEngine.js,
and src/components/ScannerDashboard.jsx into your existing Vite/React
repo at the matching paths.
Render <ScannerDashboard /> from a route/page in your app (same pattern
as your existing GroWiz OTC dashboard).
Get a free Twelve Data API key at twelvedata.com — needed for forex and
commodities. Crypto uses Binance's public endpoint, no key required.
Paste the key into the dashboard's input field (stored in localStorage).
