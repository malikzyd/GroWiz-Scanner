// src/lib/dailyBias.js
//
// Determines a pair's DAILY bias using market structure — the same concept
// as your intraday OB/FVG engine, just run on daily candles: a sequence of
// higher-highs + higher-lows = bullish structure; lower-highs + lower-lows
// = bearish; anything else = ranging (no clear bias — this is intentional,
// not every pair has a clean daily bias every day).

function findSwings(candles, lookback = 2) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const c = candles[i];
    if (c.high === Math.max(...window.map((w) => w.high))) highs.push({ index: i, price: c.high });
    if (c.low === Math.min(...window.map((w) => w.low))) lows.push({ index: i, price: c.low });
  }
  return { highs, lows };
}

export function getDailyBias(dailyCandles) {
  if (!dailyCandles || dailyCandles.length < 15) {
    return { bias: "unknown", reason: "not enough daily candles" };
  }

  const { highs, lows } = findSwings(dailyCandles);
  const recentHighs = highs.slice(-3);
  const recentLows = lows.slice(-3);

  if (recentHighs.length < 2 || recentLows.length < 2) {
    return { bias: "ranging", reason: "not enough recent swing points to confirm structure" };
  }

  const higherHighs = recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price;
  const higherLows = recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;
  const lowerHighs = recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
  const lowerLows = recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price;

  if (higherHighs && higherLows) {
    return { bias: "bullish", reason: "higher highs + higher lows on daily structure" };
  }
  if (lowerHighs && lowerLows) {
    return { bias: "bearish", reason: "lower highs + lower lows on daily structure" };
  }
  return { bias: "ranging", reason: "mixed daily structure — no clean directional bias" };
}

// Recent key support/resistance — shown even when there's no trade signal,
// per your requirement that pairs with no valid entry still show levels.
export function getKeyLevels(dailyCandles) {
  const { highs, lows } = findSwings(dailyCandles);
  const resistance = highs.slice(-1)[0]?.price ?? null;
  const support = lows.slice(-1)[0]?.price ?? null;
  return { support, resistance };
}
