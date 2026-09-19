// src/lib/dataFeeds.js
//
// Three sources now:
// - Binance SPOT   -> crypto (BTC, ETH, etc.) — free, real volume
// - Binance FUTURES -> gold & silver (XAUUSDT/XAGUSDT) — free, real volume,
//   launched Jan 2026 as regulated TradFi perpetuals
// - Our /api/forex-candles proxy -> forex + oil + copper — needs the
//   Twelve Data key held server-side, volume is estimated (no real feed)

import { runPaced } from "./rateLimiter";

const BINANCE_INTERVAL_MAP = {
  "5min": "5m",
  "15min": "15m",
  "1h": "1h",
  "4h": "4h",
  "1day": "1d",
};

function parseBinanceKlines(raw) {
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

export async function fetchCryptoCandles(symbol, timeframe = "5min", limit = 100) {
  const interval = BINANCE_INTERVAL_MAP[timeframe] || "5m";
  // data-api.binance.vision is Binance's dedicated public-market-data
  // endpoint — same data as api.binance.com, but meant specifically for
  // this kind of read-only use and less prone to WAF-triggered 403s.
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance spot fetch failed for ${symbol}: ${res.status}`);
  return parseBinanceKlines(await res.json());
}

// Gold (XAUUSDT) & silver (XAGUSDT) via Binance's regulated futures perpetuals.
export async function fetchBinanceCommodityCandles(symbol, timeframe = "5min", limit = 100) {
  const interval = BINANCE_INTERVAL_MAP[timeframe] || "5m";
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance futures fetch failed for ${symbol}: ${res.status}`);
  return parseBinanceKlines(await res.json());
}

// Forex + oil + copper, via our own backend (holds the Twelve Data key).
// Routed through runPaced so EVERY call to Twelve Data — across daily,
// 1H, 15min, 5min, for every pair — is serialized at a safe rate. This
// fixes the silent-failure bug where unpaced bursts got rejected.
export async function fetchForexCandles(symbol, timeframe = "5min", limit = 100) {
  return runPaced(async () => {
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
          open, high, low, close,
          volume: null,
          buyVolume: buyPressure,
          sellVolume: sellPressure,
          volumeIsEstimated: true,
        };
      });
  });
}

// Paces requests to the proxy (forex/oil/copper only — crypto and Binance
// commodities are free/generous enough to run in parallel instead).
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
