// src/lib/dataFeeds.js
//
// Normalizes candles from two different sources into one shape:
// { time, open, high, low, close, volume, buyVolume, sellVolume, volumeIsEstimated }
//
// IMPORTANT HONESTY NOTE:
// - Crypto (Binance) volume is real exchange volume, split into taker buy/sell.
// - Forex & commodities have NO centralized volume (it's an OTC market).
//   "buyVolume"/"sellVolume" for those is an ESTIMATE derived from candle
//   shape (close position within the high-low range), not real order flow.
//   volumeIsEstimated=true is set so the UI can label it honestly.

const BINANCE_INTERVAL_MAP = {
  "5min": "5m",
  "15min": "15m",
  "1h": "1h",
};

const TWELVEDATA_INTERVAL_MAP = {
  "5min": "5min",
  "15min": "15min",
  "1h": "1h",
};

export async function fetchCryptoCandles(symbol, timeframe = "5min", limit = 100) {
  const interval = BINANCE_INTERVAL_MAP[timeframe] || "5m";
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance fetch failed for ${symbol}: ${res.status}`);
  const raw = await res.json();

  return raw.map((k) => {
    const [openTime, open, high, low, close, volume, , , , takerBuyBaseVol] = k;
    const vol = parseFloat(volume);
    const buyVol = parseFloat(takerBuyBaseVol);
    const sellVol = Math.max(vol - buyVol, 0);
    return {
      time: openTime,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: vol,
      buyVolume: buyVol,
      sellVolume: sellVol,
      volumeIsEstimated: false,
    };
  });
}

export async function fetchTwelveDataCandles(symbol, timeframe = "5min", apiKey, limit = 100) {
  const interval = TWELVEDATA_INTERVAL_MAP[timeframe] || "5min";
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&outputsize=${limit}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data fetch failed for ${symbol}: ${res.status}`);
  const json = await res.json();
  if (json.status === "error") throw new Error(`Twelve Data error for ${symbol}: ${json.message}`);

  const values = json.values || [];
  // Twelve Data returns newest-first; flip to oldest-first to match Binance.
  return values
    .slice()
    .reverse()
    .map((v) => {
      const open = parseFloat(v.open);
      const high = parseFloat(v.high);
      const low = parseFloat(v.low);
      const close = parseFloat(v.close);
      const range = Math.max(high - low, 1e-9);
      // Estimated buy/sell pressure from candle shape, NOT real order flow.
      const buyPressure = (close - low) / range;
      const sellPressure = (high - close) / range;
      return {
        time: new Date(v.datetime).getTime(),
        open,
        high,
        low,
        close,
        volume: null,
        buyVolume: buyPressure,
        sellVolume: sellPressure,
        volumeIsEstimated: true,
      };
    });
}

// Simple sequential-with-delay fetcher to respect Twelve Data's free-tier
// rate limit (8 requests/minute on the free plan as of writing — verify
// your current plan's limit before raising batch size or lowering delayMs).
export async function fetchBatch(symbols, fetchFn, delayMs = 8000) {
  const results = {};
  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchFn(symbol);
    } catch (err) {
      results[symbol] = { error: err.message };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}
