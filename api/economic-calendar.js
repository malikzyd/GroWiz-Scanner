// api/economic-calendar.js
//
// Free Finnhub API key required (finnhub.io). Set FINNHUB_API_KEY in
// Vercel env vars — if you deleted it during the earlier cleanup, add it
// back now.

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
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
