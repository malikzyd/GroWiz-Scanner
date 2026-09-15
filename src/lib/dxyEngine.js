// src/lib/dxyEngine.js
//
// DXY (US Dollar Index) is fetched through the same Twelve Data proxy as
// your forex pairs. It gets its own daily bias via the same market
// structure logic, then we check correlation: if DXY is bullish (dollar
// strengthening), USD-quoted pairs (EUR/USD, GBP/USD, etc — USD is the
// quote currency) should lean bearish, while USD-base pairs (USD/JPY,
// USD/CAD, etc) should lean bullish, and vice versa.
//
// NOTE: verify "DXY" is the exact symbol your Twelve Data plan recognizes
// (check their symbol search in your dashboard) — if it 404s, this is the
// one thing to adjust.

import { getDailyBias } from "./dailyBias";

export async function getDxyBias(fetchForexCandles) {
  try {
    const candles = await fetchForexCandles("DXY", "1day", 60);
    return getDailyBias(candles);
  } catch (err) {
    return { bias: "unknown", reason: `DXY fetch failed: ${err.message}` };
  }
}

// Returns "aligned" | "conflicting" | "neutral" for a given pair vs DXY bias.
export function getDxyAlignment(pairSymbol, pairBias, dxyBias) {
  if (dxyBias === "unknown" || dxyBias === "ranging" || pairBias === "unknown") {
    return "neutral"; // not enough info to confirm or deny — doesn't block a trade
  }

  const isUsdBase = pairSymbol.startsWith("USD/") || pairSymbol.startsWith("USDT") === false && pairSymbol.startsWith("USD");
  const isUsdQuote = pairSymbol.endsWith("/USD") || pairSymbol.includes("USDT") || pairSymbol.includes("USDC");

  if (!isUsdBase && !isUsdQuote) return "neutral"; // pair doesn't involve USD directly (e.g. EUR/GBP)

  // Expected pair bias implied by DXY direction.
  let impliedPairBias = null;
  if (isUsdBase) impliedPairBias = dxyBias; // DXY up -> USD/XXX up too
  if (isUsdQuote) impliedPairBias = dxyBias === "bullish" ? "bearish" : "bullish"; // DXY up -> XXX/USD down

  if (!impliedPairBias) return "neutral";
  return impliedPairBias === pairBias ? "aligned" : "conflicting";
}
