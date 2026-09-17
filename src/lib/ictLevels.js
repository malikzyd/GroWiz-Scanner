// src/lib/ictLevels.js
//
// Run on the 1H timeframe per your spec: draws order blocks, FVGs, and an
// approximate "market maker model" phase (accumulation / manipulation /
// distribution). The MMXM phase read is a simplified proxy — real MMXM
// classification is discretionary even for experienced ICT traders, so
// treat this as a supporting signal, not a certainty.

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

export function averageTrueRange(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
}

export function findFVGs(candles) {
  const fvgs = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c1.high < c3.low) fvgs.push({ type: "bullish", top: c3.low, bottom: c1.high, index: i, time: c3.time });
    if (c1.low > c3.high) fvgs.push({ type: "bearish", top: c1.low, bottom: c3.high, index: i, time: c3.time });
  }
  return fvgs.filter((fvg) => {
    const after = candles.slice(fvg.index + 1);
    return !after.some((c) => c.low <= fvg.bottom && c.high >= fvg.top); // unfilled only
  });
}

export function findOrderBlocks(candles, impulseAtrMult = 1.5) {
  const { highs, lows } = findSwings(candles);
  const atr = averageTrueRange(candles);
  const obs = [];

  for (let i = 5; i < candles.length - 1; i++) {
    const move = candles[i + 1].close - candles[i].close;
    if (Math.abs(move) <= atr * impulseAtrMult) continue;

    if (move > 0) {
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (candles[j].close < candles[j].open) {
          if (highs.some((sh) => sh.index < j && candles[i + 1].high > sh.price)) {
            obs.push({ type: "bullish", top: candles[j].high, bottom: candles[j].low, index: j, time: candles[j].time });
          }
          break;
        }
      }
    } else {
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (candles[j].close > candles[j].open) {
          if (lows.some((sl) => sl.index < j && candles[i + 1].low < sl.price)) {
            obs.push({ type: "bearish", top: candles[j].high, bottom: candles[j].low, index: j, time: candles[j].time });
          }
          break;
        }
      }
    }
  }

  return obs.filter((ob) => {
    const after = candles.slice(ob.index + 1);
    if (ob.type === "bullish") return !after.some((c) => c.low < ob.bottom);
    return !after.some((c) => c.high > ob.top);
  });
}

// Rough MMXM phase proxy: compares recent volatility/range contraction
// (accumulation), a sweep beyond the range (manipulation), and a strong
// directional push away from it (distribution).
export function estimateMarketMakerPhase(candles) {
  if (candles.length < 20) return { phase: "unknown" };
  const atr = averageTrueRange(candles);
  const recent = candles.slice(-10);
  const older = candles.slice(-20, -10);
  const recentRange = Math.max(...recent.map((c) => c.high)) - Math.min(...recent.map((c) => c.low));
  const olderRange = Math.max(...older.map((c) => c.high)) - Math.min(...older.map((c) => c.low));

  const last = candles[candles.length - 1];
  const { highs, lows } = findSwings(older);
  const priorHigh = highs.slice(-1)[0]?.price;
  const priorLow = lows.slice(-1)[0]?.price;
  const sweptHigh = priorHigh && last.high > priorHigh;
  const sweptLow = priorLow && last.low < priorLow;

  if (sweptHigh || sweptLow) return { phase: "manipulation", detail: sweptHigh ? "swept prior high" : "swept prior low" };
  if (recentRange < olderRange * 0.6) return { phase: "accumulation", detail: "range contracting" };
  if (recentRange > olderRange * 1.4) return { phase: "distribution", detail: "range expanding, trending" };
  return { phase: "unclear" };
}

export function nearestByPrice(items, refPrice, getPrice) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.abs(getPrice(item) - refPrice);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}
