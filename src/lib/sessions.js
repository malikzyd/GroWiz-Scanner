// src/lib/sessions.js
import { findSwings } from "./marketStructure";

export function getActiveKillZone(date = new Date()) {
  const h = date.getUTCHours();
  if (h >= 0 && h < 6) return { name: "Asian", active: true };
  if (h >= 7 && h < 10) return { name: "London", active: true };
  if (h >= 12 && h < 15) return { name: "New York AM", active: true };
  if (h >= 19 && h < 20) return { name: "New York PM (Silver Bullet)", active: true };
  return { name: "Off-session", active: false };
}

// Session liquidity: the most recent swing high (resting sell-side
// liquidity / buy-stops above) and swing low (resting buy-side liquidity
// / sell-stops below) on whichever timeframe you pass in.
export function getSessionLiquidity(candles) {
  const { highs, lows } = findSwings(candles);
  return {
    sellSideLiquidity: highs.slice(-1)[0]?.price ?? null, // resting above price
    buySideLiquidity: lows.slice(-1)[0]?.price ?? null, // resting below price
  };
}
