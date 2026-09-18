// src/lib/newsAnalysis.js
//
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
    return "pending"; // hasn't released yet
  }
  const lowerIsBullish = LOWER_IS_BULLISH_KEYWORDS.some((kw) => (event.event || "").toLowerCase().includes(kw));
  const beat = actual > estimate;
  if (actual === estimate) return "neutral";
  const bullish = lowerIsBullish ? !beat : beat;
  return bullish ? "bullish" : "bearish";
}

export async function getTodaysNews() {
  const res = await fetch("/api/economic-calendar");
  const json = await res.json();
  const events = json.economicCalendar || json.events || [];

  return events
    .filter(isHighImpact)
    .map((e) => ({
      time: e.time,
      currency: COUNTRY_TO_CURRENCY[e.country] || e.country,
      event: e.event,
      actual: e.actual,
      estimate: e.estimate,
      previous: e.prev,
      direction: tagDirection(e),
    }))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
