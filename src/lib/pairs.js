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

export const COMMODITY_PAIRS = [
  "XAU/USD", // Gold
  "XAG/USD", // Silver
  "WTI/USD", // Crude oil (WTI)
  "BRENT/USD", // Crude oil (Brent) - availability depends on your data provider's plan
  "XCU/USD", // Copper
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
  ...COMMODITY_PAIRS.map((s) => ({ symbol: s, market: "commodity" })),
  ...CRYPTO_PAIRS.map((s) => ({ symbol: s, market: "crypto" })),
];
