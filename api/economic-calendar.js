// api/economic-calendar.js - Forex Factory official feed
export default async function handler(req, res) {
  try {
    const upstream = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "GroWiz/1.0" }
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `FF ${upstream.status}`, events: [] });
    }
    const data = await upstream.json();
    const normalized = data.map(e => ({
      time: e.date,
      country: e.country,
      event: e.title,
      actual: e.actual,
      estimate: e.forecast,
      prev: e.previous,
      impact: e.impact
    }));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");
    return res.status(200).json({ economicCalendar: normalized, events: normalized });
  } catch (err) {
    return res.status(502).json({ error: err.message, events: [] });
  }
}
