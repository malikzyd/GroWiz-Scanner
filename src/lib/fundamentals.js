// src/lib/fundamentals.js

// Finnhub reports events by country, not currency — map the ones relevant
// to your pair universe.
const COUNTRY_TO_CURRENCY = {
  US: "USD",
  EU: "EUR",
  EMU: "EUR",
  GB: "GBP",
  UK: "GBP",
  JP: "JPY",
  CH: "CHF",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  CN: "CNY",
  ZA: "ZAR",
  MX: "MXN",
  TR: "TRY",
  NO: "NOK",
  SE: "SEK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  SG: "SGD",
  HK: "HKD",
};

function isHighImpact(event) {
  const impact = String(event.impact ?? "").toLowerCase();
  return impact === "high" || impact === "3" || Number(event.impact) === 3;
}

// Returns a Set of currency codes with a high-impact event today —
// e.g. {"USD", "EUR"} — so the scan can flag pairs involving those
// currencies as "elevated volatility risk" rather than silently ignoring
// news risk.
export async function getTodaysHighImpactCurrencies() {
  try {
    const res = await fetch("/api/economic-calendar");
    const json = await res.json();
    const events = json.economicCalendar || json.events || [];
    const currencies = new Set();
    for (const event of events) {
      if (!isHighImpact(event)) continue;
      const currency = COUNTRY_TO_CURRENCY[event.country];
      if (currency) currencies.add(currency);
    }
    return currencies;
  } catch (err) {
    // Fail open: if the calendar fetch fails, don't block scanning —
    // just proceed without the fundamentals flag for this scan.
    return new Set();
  }
}

export function pairTouchesHighImpactNews(symbol, highImpactCurrencies) {
  for (const currency of highImpactCurrencies) {
    if (symbol.includes(currency)) return true;
  }
  return false;
}
