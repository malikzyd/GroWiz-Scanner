// src/lib/plans.js

// The specific 10 forex pairs free users get — majors + a few common
// crosses. Adjust this list if you want different ones.
export const FREE_FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD",
  "AUD/USD", "NZD/USD", "EUR/GBP", "GBP/JPY", "USD/ZAR",
];
export const FREE_CRYPTO_PAIRS = ["BTCUSDT"];
export const FREE_COMMODITY_PAIRS = ["XAUUSDT"]; // gold only

export const PLANS = {
  free: {
    label: "Free",
    scansPerDay: 3,
    pairRestricted: true, // uses FREE_* lists above instead of ALL_PAIRS
    newsAccess: false,
    signalPanelAccess: false,
    price: 0,
  },
  pro: {
    label: "Pro",
    scansPerDay: Infinity,
    pairRestricted: false, // all forex + commodities + crypto
    newsAccess: false,
    signalPanelAccess: false,
    price: 29,
    billingPeriod: "month",
  },
  premium: {
    label: "Premium",
    scansPerDay: Infinity,
    pairRestricted: false,
    newsAccess: true,
    signalPanelAccess: true,
    signalsPerDay: 10,
    price: 59,
    billingPeriod: "month",
  },
  founding: {
    label: "Founding Member",
    scansPerDay: Infinity,
    pairRestricted: false,
    newsAccess: true,
    signalPanelAccess: true,
    signalsPerDay: 10,
    price: 59, // one-time — ASSUMPTION, confirm with user
    billingPeriod: "lifetime",
  },
};

export function getPlanConfig(planKey) {
  return PLANS[planKey] || PLANS.free;
}
