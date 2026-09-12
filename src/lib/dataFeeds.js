// src/lib/dataFeeds.js
//
// Normalizes candles from two different sources into one shape:
// { time, open, high, low, close, volume, buyVolume, sellVolume, volumeIsEstimated }
//
// Crypto -> Binance public endpoint directly (free, no key, generous limits).
// Forex/commodities -> our own /api/forex-candles serverless function, which
// holds the Twelve Data key server-side. Users never see or enter a key.

const BINANCE_INTERVAL_MAP = {
  "5min": "5m",
  "15min": "15m",
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

// Calls OUR backend, not Twelve Data directly. No API key required or
// accepted from the caller.
export async function fetchForexCandles(symbol, timeframe = "5min", limit = 100) {
  const url = `/api/forex-candles?symbol=${encodeURIComponent(
    symbol
  )}&interval=${timeframe}&outputsize=${limit}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `forex-candles proxy failed for ${symbol}`);

  const values = json.values || [];
  return values
    .slice()
    .reverse()
    .map((v) => {
      const open = parseFloat(v.open);
      const high = parseFloat(v.high);
      const low = parseFloat(v.low);
      const close = parseFloat(v.close);
      const range = Math.max(high - low, 1e-9);
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

// Paces requests to the proxy. The proxy caches each symbol for 60s
// (see api/forex-candles.js), so concurrent users scanning close together
// in time share upstream credits rather than each consuming their own —
// that's what keeps one shared Twelve Data key viable across subscribers.
// Still worth pacing client-side so a single scan doesn't fire 44 requests
// at once against your own serverless function.
export async function fetchBatch(symbols, fetchFn, delayMs = 300) {
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
