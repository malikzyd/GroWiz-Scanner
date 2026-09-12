// src/lib/pairs.js
// Full universe the scanner sweeps every cycle.
// symbol formats differ by feed:
//  - forex/commodities -> Twelve Data format "EUR/USD"
//  - crypto -> Binance format "BTCUSDT"

export const FOREX_PAIRS = [
  // 7 majors
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD", "AUD/USD", "NZD/USD",
  // crosses (21)
  "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/CAD", "EUR/AUD", "EUR/NZD",
  "GBP/JPY", "GBP/CHF", "GBP/CAD", "GBP/AUD", "GBP/NZD",
  "AUD/JPY", "AUD/CHF", "AUD/CAD", "AUD/NZD",
  "NZD/JPY", "NZD/CHF", "NZD/CAD",
  "CAD/JPY", "CAD/CHF", "CHF/JPY",
  // minors / regional to round out to 39
  "USD/SGD", "USD/HKD", "USD/ZAR", "USD/MXN", "USD/TRY",
  "USD/NOK", "USD/SEK", "USD/DKK", "USD/PLN", "USD/CZK", "USD/HUF",
];

// Gold & silver: real, free, via Binance's regulated TradFi perpetuals
// (XAUUSDT / XAGUSDT), launched Jan 2026. Same public API as crypto.
export const BINANCE_COMMODITY_PAIRS = [
  "XAUUSDT", // Gold
  "XAGUSDT", // Silver
];

// Oil & copper: no free Binance equivalent found — still requires
// Twelve Data's paid Basic+ plan via the /api/forex-candles proxy.
export const TWELVEDATA_COMMODITY_PAIRS = [
  "WTI/USD", // Crude oil (WTI)
  "BRENT/USD", // Crude oil (Brent)
  "HG1", // Copper
];

// "Big 7" crypto, Binance symbol format (quoted in USDT)
export const CRYPTO_PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
];

export const ALL_PAIRS = [
  ...FOREX_PAIRS.map((s) => ({ symbol: s, market: "forex" })),
  ...TWELVEDATA_COMMODITY_PAIRS.map((s) => ({ symbol: s, market: "commodity-td" })),
  ...BINANCE_COMMODITY_PAIRS.map((s) => ({ symbol: s, market: "commodity-binance" })),
  ...CRYPTO_PAIRS.map((s) => ({ symbol: s, market: "crypto" })),
];
