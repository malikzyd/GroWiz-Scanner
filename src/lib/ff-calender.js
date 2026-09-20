// src/app/api/economic-calendar/route.js  (for App Router - RECOMMENDED)
// If you use pages/ folder, use second version below

export async function GET() {
  try {
    const upstream = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      next: { revalidate: 900 }, // cache 15 min
      headers: {
        "User-Agent": "GroWiz/1.0",
      },
    });

    if (!upstream.ok) {
      return Response.json({ error: `Forex Factory feed ${upstream.status}`, events: [] }, { status: 502 });
    }

    const data = await upstream.json();

    // Normalize to what newsAnalysis.js expects
    const normalized = (Array.isArray(data) ? data : []).map((e) => ({
      time: e.date || e.time || "",
      country: e.country || "US",
      event: e.title || e.event || "",
      actual: e.actual ?? null,
      estimate: e.forecast ?? e.estimate ?? null,
      prev: e.previous ?? null,
      impact: e.impact || "Low", // High, Medium, Low
    }));

    return Response.json(
      { economicCalendar: normalized, events: normalized },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("FF proxy error:", err);
    return Response.json({ error: err.message, events: [], economicCalendar: [] }, { status: 502 });
  }
}
