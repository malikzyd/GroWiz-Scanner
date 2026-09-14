// src/lib/plans.js

export const PLANS = {
  free: {
    label: "Free",
    scansPerDay: 2,
    forexCount: 5,
    cryptoCount: 3,
    commodities: false,
    usIndices: false,
    price: 0,
  },
  starter: {
    label: "Starter",
    scansPerDay: 5,
    forexCount: 10,
    cryptoCount: 3,
    commodities: false,
    usIndices: false,
    price: 12,
  },
  pro: {
    label: "Pro",
    scansPerDay: 10,
    forexCount: 20,
    cryptoCount: 7,
    commodities: false,
    usIndices: false,
    price: 29,
  },
  premium: {
    label: "Premium",
    scansPerDay: Infinity,
    forexCount: Infinity, // all 39
    cryptoCount: Infinity, // all 7
    commodities: true,
    usIndices: true,
    price: 59,
  },
};

export function getPlanConfig(planKey) {
  return PLANS[planKey] || PLANS.free;
}
