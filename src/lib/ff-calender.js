// api/ff-calendar.js
//
// Forex Factory's own official free weekly calendar export — not a
// scrape, this is their published export endpoint, widely used by
// legitimate trading tools (MT4/MT5 indicators etc). Proxied here mainly
// to avoid browser CORS issues and add light caching.

export default async function handler(req, res) {
  try {
    const upstream = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
    if (!upstream.ok) {
      return res.status(502).json({ error: `Forex Factory feed returned ${upstream.status}` });
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
