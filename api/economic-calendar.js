// api/economic-calendar.js
//
// Vercel serverless function. Free Finnhub API key required — sign up at
// finnhub.io (free tier), then set FINNHUB_API_KEY in Vercel env vars,
// same pattern as TWELVE_DATA_API_KEY.

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "server is missing FINNHUB_API_KEY" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${today}&token=${apiKey}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    // Cache for 30 minutes — the calendar for "today" doesn't need to be
    // re-fetched on every single scan.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
