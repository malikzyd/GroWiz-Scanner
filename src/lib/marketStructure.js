// src/lib/marketStructure.js
//
// Real ICT-style market structure: classifies a leg as bullish (HH+HL),
// bearish (LH+LL), or ranging, using swing points — same underlying
// method for both the daily and 4H timeframe, per your spec.
// PD array = premium/discount of the current dealing range, a standard
// public ICT concept: the midpoint (equilibrium) of the most recent
// swing range splits it into a "premium" (upper, sell) and "discount"
// (lower, buy) zone.

function findSwings(candles, lookback = 2) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const c = candles[i];
    if (c.high === Math.max(...window.map((w) => w.high))) highs.push({ index: i, price: c.high, time: c.time });
    if (c.low === Math.min(...window.map((w) => w.low))) lows.push({ index: i, price: c.low, time: c.time });
  }
  return { highs, lows };
}

// trend: "bullish" | "bearish" | "ranging" | "unknown"
// state: what the latest leg is doing relative to the prior one —
// "continuation" (pushing to a new high/low in trend direction),
// "pullback" (retracing against the trend), "reversal" (structure flipped)
export function classifyStructure(candles, label = "structure") {
  if (!candles || candles.length < 12) {
    return { trend: "unknown", state: "unknown", reason: `not enough ${label} candles`, equilibrium: null, premiumDiscount: null };
  }

  const { highs, lows } = findSwings(candles);
  const recentHighs = highs.slice(-3);
  const recentLows = lows.slice(-3);

  if (recentHighs.length < 2 || recentLows.length < 2) {
    return { trend: "ranging", state: "unclear", reason: `not enough swing points on ${label}`, equilibrium: null, premiumDiscount: null };
  }

  const hh = recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price;
  const hl = recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;
  const lh = recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
  const ll = recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price;

  let trend = "ranging";
  if (hh && hl) trend = "bullish";
  else if (lh && ll) trend = "bearish";

  // State: is the most recent close pushing toward a new extreme
  // (continuation) or pulling back into the range (pullback)?
  const lastClose = candles[candles.length - 1].close;
  const lastSwingHigh = recentHighs[recentHighs.length - 1].price;
  const lastSwingLow = recentLows[recentLows.length - 1].price;
  const rangeSize = Math.max(lastSwingHigh - lastSwingLow, 1e-9);
  const posInRange = (lastClose - lastSwingLow) / rangeSize; // 0 = at low, 1 = at high

  let state = "pullback";
  if (trend === "bullish") state = posInRange > 0.8 ? "continuation (near new high)" : "pullback";
  if (trend === "bearish") state = posInRange < 0.2 ? "continuation (near new low)" : "pullback";
  if (trend === "ranging") state = "unclear";

  const equilibrium = (lastSwingHigh + lastSwingLow) / 2;
  const premiumDiscount = lastClose > equilibrium ? "premium" : "discount";

  return {
    trend,
    state,
    reason: trend === "ranging" ? `mixed structure on ${label} — no clean bias` : `${trend} structure on ${label}`,
    swingHigh: lastSwingHigh,
    swingLow: lastSwingLow,
    equilibrium,
    premiumDiscount,
  };
}

export function getKeyLevels(candles) {
  const { highs, lows } = findSwings(candles);
  return {
    support: lows.slice(-1)[0]?.price ?? null,
    resistance: highs.slice(-1)[0]?.price ?? null,
  };
}

export { findSwings };
