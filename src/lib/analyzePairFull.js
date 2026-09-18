// src/lib/analyzePairFull.js
//
// Funnel: Daily bias -> 1H structure confirmation -> 15min OB/FVG marking
// (filtered to discount zone for longs / premium zone for shorts, using
// the 1H dealing range) -> 5min entry (named ICT setup, or the filtered
// OB/FVG's own edge price as a fallback entry).

import { classifyStructure, getKeyLevels } from "./marketStructure";
import { findFVGs, findOrderBlocks, nearestByPrice, averageTrueRange } from "./ictLevels";
import { findEntrySetup, buildLevelsFromSetup } from "./ictSetups";
import { getCached, setCached, CACHE_TTL } from "./cache";
import { getActiveKillZone, getSessionLiquidity } from "./sessions";

function inZone(price, bias, equilibrium) {
  // Discount = below equilibrium (for longs); Premium = above equilibrium (for shorts) — see chat note on this mirroring.
  return bias === "bullish" ? price < equilibrium : price > equilibrium;
}

export async function analyzePairFull({ symbol, market, fetchers }) {
  // --- Step 1: Daily bias (cached) ---
  const dailyCacheKey = `daily:${symbol}`;
  let dailyCandles = getCached(dailyCacheKey, CACHE_TTL.daily);
  if (!dailyCandles) {
    try {
      dailyCandles = await fetchers.fetchDaily(symbol);
      setCached(dailyCacheKey, dailyCandles);
    } catch (err) {
      return { symbol, market, error: `daily fetch failed: ${err.message}` };
    }
  }
  const daily = classifyStructure(dailyCandles, "daily");

  if (daily.trend === "unknown" || daily.trend === "ranging") {
    return {
      symbol, market, action: "wait",
      waitReason: `no clean daily bias (${daily.reason})`,
      dailyBias: daily.trend, intradayBias: null,
      keyLevels: getKeyLevels(dailyCandles),
    };
  }

  // --- Step 2: 1H structure — confirms the coming move, must agree with daily ---
  let oneHCandles;
  try {
    oneHCandles = await fetchers.fetchOneHour(symbol);
  } catch (err) {
    return { symbol, market, error: `1H fetch failed: ${err.message}`, dailyBias: daily.trend };
  }
  const oneH = classifyStructure(oneHCandles, "1H");

  if (oneH.trend !== daily.trend) {
    return {
      symbol, market, action: "wait",
      waitReason: `1H structure (${oneH.trend}) not aligned with daily bias (${daily.trend})`,
      dailyBias: daily.trend, intradayBias: oneH.trend,
      keyLevels: getKeyLevels(oneHCandles),
    };
  }

  const bias = daily.trend; // confirmed on daily + 1H
  const equilibrium = oneH.equilibrium;
  const killZone = getActiveKillZone();
  const sessionLiquidity = getSessionLiquidity(oneHCandles);

  // --- Step 3: 15min — mark all OBs/FVGs, filter to discount/premium zone ---
  let fifteenCandles;
  try {
    fifteenCandles = await fetchers.fetchFifteen(symbol);
  } catch (err) {
    return {
      symbol, market, action: "wait",
      waitReason: `15min fetch failed: ${err.message}`,
      dailyBias: bias, intradayBias: oneH.trend,
      keyLevels: getKeyLevels(oneHCandles), killZone, sessionLiquidity,
    };
  }

  const allObs = findOrderBlocks(fifteenCandles).filter((o) => o.type === bias);
  const allFvgs = findFVGs(fifteenCandles).filter((f) => f.type === bias);
  const zoneObs = equilibrium != null ? allObs.filter((o) => inZone((o.top + o.bottom) / 2, bias, equilibrium)) : allObs;
  const zoneFvgs = equilibrium != null ? allFvgs.filter((f) => inZone((f.top + f.bottom) / 2, bias, equilibrium)) : allFvgs;

  const lastClose = fifteenCandles[fifteenCandles.length - 1].close;
  const nearestOb = nearestByPrice(zoneObs, lastClose, (o) => (o.top + o.bottom) / 2);
  const nearestFvg = nearestByPrice(zoneFvgs, lastClose, (f) => (f.top + f.bottom) / 2);
  const keyLevels = getKeyLevels(oneHCandles);

  const baseResult = {
    symbol, market,
    dailyBias: bias,
    intradayBias: oneH.trend,
    keyLevels,
    killZone, sessionLiquidity,
    orderBlock: nearestOb ? { ...nearestOb, price: (nearestOb.top + nearestOb.bottom) / 2 } : null,
    fvg: nearestFvg ? { ...nearestFvg, price: (nearestFvg.top + nearestFvg.bottom) / 2 } : null,
  };

  if (!nearestOb && !nearestFvg) {
    return { ...baseResult, action: "wait", waitReason: `no ${bias === "bullish" ? "discount" : "premium"}-zone OB/FVG found on 15min yet` };
  }

  // --- Step 4: 5min — named ICT setup, else fallback to the zone's edge price ---
  let fiveCandles;
  try {
    fiveCandles = await fetchers.fetchFive(symbol);
  } catch (err) {
    return { ...baseResult, action: "wait", waitReason: `5min fetch failed: ${err.message}` };
  }

  const candidate = findEntrySetup(fiveCandles, bias);

  if (candidate) {
    const levels = buildLevelsFromSetup(candidate, fiveCandles);
    return {
      ...baseResult, action: "entry",
      setupName: candidate.setup, setupReason: candidate.reason,
      entry: levels.entry, sl: levels.sl, tp: levels.tp, riskRewardRatio: levels.riskRewardRatio,
    };
  }

  // Fallback: enter at the "lowest level" of the zone for longs (the
  // deepest/cheapest price in the OB/FVG), or the highest level for
  // shorts (mirrored) — per your instruction.
  const zone = nearestOb || nearestFvg;
  const atr = averageTrueRange(fiveCandles);
  const slBuffer = atr * 0.35;

  let entry, sl, tp;
  if (bias === "bullish") {
    entry = zone.bottom; // lowest level of the zone
    sl = entry - slBuffer;
    tp = entry + (entry - sl) * 1.5;
  } else {
    entry = zone.top; // mirrored: highest level of the zone
    sl = entry + slBuffer;
    tp = entry - (sl - entry) * 1.5;
  }

  return {
    ...baseResult, action: "entry",
    setupName: nearestOb ? "Order Block entry" : "FVG entry",
    setupReason: `no named setup fired — entered at the ${bias === "bullish" ? "lowest" : "highest"} level of the ${nearestOb ? "order block" : "FVG"}`,
    entry, sl, tp, riskRewardRatio: 1.5,
  };
}
