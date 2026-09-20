// src/lib/newsAnalysis.js
//
// Merges: Forex Factory (economic calendar) + Finnhub (market news)
// HONEST NOTE: the bullish/bearish tag here is a simplified heuristic —
// actual > estimate = bullish for that currency, EXCEPT for a small list
// of "lower is better" indicators (unemployment, jobless claims) where
// it's inverted. Real market reaction depends on positioning, other
// concurrent data, and central bank context — treat this as a rough
// directional guide, not a guarantee of how price will actually move.

const COUNTRY_TO_CURRENCY = {
  US: "USD", EU: "EUR", EMU: "EUR", GB: "GBP", UK: "GBP", JP: "JPY",
  CH: "CHF", CA: "CAD", AU: "AUD", NZ: "NZD", CN: "CNY", ZA: "ZAR",
  MX: "MXN", TR: "TRY", NO: "NOK", SE: "SEK", DK: "DKK", PL: "PLN",
  CZ: "CZK", HU: "HUF", SG: "SGD", HK: "HKD",
};

const LOWER_IS_BULLISH_KEYWORDS = ["unemployment", "jobless", "claims", "trade deficit"];

function isHighImpact(event) {
  const impact = String(event.impact ?? "").toLowerCase();
  return impact === "high" || impact === "3" || Number(event.impact) === 3;
}

function tagDirection(event) {
  const actual = event.actual;
  const estimate = event.estimate;
  if (actual === null || actual === undefined || estimate === null || estimate === undefined) {
    return "pending";
  }
  const lowerIsBullish = LOWER_IS_BULLISH_KEYWORDS.some((kw) => (event.event || "").toLowerCase().includes(kw));
  const beat = actual > estimate;
  if (actual === estimate) return "neutral";
  const bullish = lowerIsBullish ? !beat : beat;
  return bullish ? "bullish" : "bearish";
}

async function getForexFactoryEvents() {
  try {
    const res = await fetch("/api/economic-calendar");
    const json = await res.json();
    const events = json.economicCalendar || json.events || json.data || [];
    return events
      .filter(isHighImpact)
      .map((e) => ({
        id: `ff-${e.time}-${e.event}`,
        time: e.time,
        currency: COUNTRY_TO_CURRENCY[e.country] || e.country || "USD",
        event: e.event,
        actual: e.actual ?? null,
        estimate: e.estimate ?? null,
        previous: e.prev ?? e.previous ?? null,
        direction: tagDirection(e),
        source: "Forex Factory", // <- BADGE
        type: "economic",
        impact: e.impact,
      }));
  } catch (err) {
    console.error("FF fetch failed:", err);
    return [];
  }
}

async function getFinnhubNews() {
  try {
    const res = await fetch("/api/finnhub-news"); // you need this API route
    if (!res.ok) throw new Error("finnhub api failed");
    const json = await res.json();
    const news = json.news || json.data || json || [];
    return (Array.isArray(news) ? news : []).slice(0, 20).map((n) => ({
      id: `fh-${n.id || n.datetime}-${n.headline?.slice(0,10)}`,
      time: n.datetime ? new Date(n.datetime * 1000).toISOString() : new Date().toISOString(),
      currency: "USD", // Finnhub is mostly US equities
      event: n.headline || n.title,
      actual: null,
      estimate: null,
      previous: null,
      direction: "neutral", // news doesn't have beat/miss
      source: "Finnhub", // <- BADGE
      type: "market-news",
      url: n.url,
      summary: n.summary,
      image: n.image,
    }));
  } catch (err) {
    console.error("Finnhub fetch failed:", err);
    return [];
  }
}

export async function getTodaysNews() {
  const [ffEvents, finnhubNews] = await Promise.all([
    getForexFactoryEvents(),
    getFinnhubNews(),
  ]);

  // Merge + sort by time
  return [...ffEvents, ...finnhubNews].sort((a, b) => 
    (a.time || "").localeCompare(b.time || "")
  );
}

// For your NewsPanel to use source badge
export async function getMergedNewsFeed() {
  return getTodaysNews();
}
