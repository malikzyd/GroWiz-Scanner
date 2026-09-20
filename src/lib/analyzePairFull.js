// src/lib/analyzePairFull.js
//
// Daily structure sets bias + regime (trendy vs sideways/pullback).
// 1H is used only to refine the discount/premium equilibrium (falls back
// to the daily's own equilibrium if 1H fails) — it's NOT a hard
// bias-matching gate anymore, since requiring daily AND 1H to
// independently agree was too strict and caused the "stuck on one trade"
// issue. 15min marks OB/FVG filtered to discount(long)/premium(short)
// zone. 5min checks the 7 named setups, falling back to the zone's edge.

import { classifyStructure, getKeyLevels } from "./marketStructure";
import { findFVGs, findOrderBlocks, nearestByPrice, averageTrueRange } from "./ictLevels";
import { findEntrySetup, buildLevelsFromSetup } from "./ictSetups";
import { getCached, setCached, CACHE_TTL } from "./cache";
import { getActiveKillZone, getSessionLiquidity } from "./sessions";

function inZone(price, bias, equilibrium) {
  return bias === "bullish" ? price < equilibrium : price > equilibrium;
}

export async function analyzePairFull({ symbol, market, fetchers }) {
  // --- Step 1: Daily bias + regime (cached) ---
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

  const bias = daily.trend;
  const regime = daily.regime; // "trendy" | "sideways"

  // --- Step 2: 1H — used for equilibrium + session liquidity only, not a hard gate ---
  let equilibrium = daily.equilibrium;
  const oneHCacheKey = `1h:${symbol}`;
  let oneHCandles = getCached(oneHCacheKey, CACHE_TTL.oneHour);
  try {
    if (!oneHCandles) {
      oneHCandles = await fetchers.fetchOneHour(symbol);
      setCached(oneHCacheKey, oneHCandles);
    }
    const oneH = classifyStructure(oneHCandles, "1H");
    if (oneH.equilibrium != null) equilibrium = oneH.equilibrium;
  } catch (err) {
    oneHCandles = null;
    // 1H failed — proceed using the daily's own equilibrium instead of
    // failing the whole pair, so a single flaky fetch doesn't erase a pair.
  }

  const killZone = getActiveKillZone();
  const sessionLiquidity = oneHCandles ? getSessionLiquidity(oneHCandles) : getSessionLiquidity(dailyCandles);
  const opposingLiquidity = bias === "bullish" ? sessionLiquidity.sellSideLiquidity : sessionLiquidity.buySideLiquidity;

  // --- Step 3: 15min — mark OBs/FVGs, filter to discount(long)/premium(short) ---
  const fifteenCacheKey = `15min:${symbol}`;
  let fifteenCandles = getCached(fifteenCacheKey, CACHE_TTL.fifteenMin);
  if (!fifteenCandles) {
    try {
      fifteenCandles = await fetchers.fetchFifteen(symbol);
      setCached(fifteenCacheKey, fifteenCandles);
    } catch (err) {
      return {
        symbol, market, action: "wait",
        waitReason: `15min fetch failed: ${err.message}`,
        dailyBias: bias, intradayBias: regime,
        keyLevels: getKeyLevels(dailyCandles), killZone, sessionLiquidity,
      };
    }
  }

  const allObs = findOrderBlocks(fifteenCandles).filter((o) => o.type === bias);
  const allFvgs = findFVGs(fifteenCandles).filter((f) => f.type === bias);
  const zoneObs = equilibrium != null ? allObs.filter((o) => inZone((o.top + o.bottom) / 2, bias, equilibrium)) : allObs;
  const zoneFvgs = equilibrium != null ? allFvgs.filter((f) => inZone((f.top + f.bottom) / 2, bias, equilibrium)) : allFvgs;

  const lastClose = fifteenCandles[fifteenCandles.length - 1].close;
  const nearestOb = nearestByPrice(zoneObs, lastClose, (o) => (o.top + o.bottom) / 2);
  const nearestFvg = nearestByPrice(zoneFvgs, lastClose, (f) => (f.top + f.bottom) / 2);
  const keyLevels = getKeyLevels(oneHCandles || dailyCandles);

  const baseResult = {
    symbol, market,
    dailyBias: bias,
    intradayBias: regime,
    keyLevels, killZone, sessionLiquidity,
    orderBlock: nearestOb ? { ...nearestOb, price: (nearestOb.top + nearestOb.bottom) / 2 } : null,
    fvg: nearestFvg ? { ...nearestFvg, price: (nearestFvg.top + nearestFvg.bottom) / 2 } : null,
  };

  if (!nearestOb && !nearestFvg) {
    return { ...baseResult, action: "wait", waitReason: `no ${bias === "bullish" ? "discount" : "premium"}-zone OB/FVG found on 15min yet` };
  }

  // --- Step 4: 5min — named ICT setup, else fallback to the zone's edge ---
  let fiveCandles;
  try {
    fiveCandles = await fetchers.fetchFive(symbol);
  } catch (err) {
    return { ...baseResult, action: "wait", waitReason: `5min fetch failed: ${err.message}` };
  }

  const candidate = findEntrySetup(fiveCandles, bias);

  if (candidate) {
    const levels = buildLevelsFromSetup(candidate, fiveCandles, regime, opposingLiquidity);
    return {
      ...baseResult, action: "entry",
      setupName: candidate.setup, setupReason: candidate.reason,
      entry: levels.entry, sl: levels.sl, tp: levels.tp, riskRewardRatio: levels.riskRewardRatio,
    };
  }

  const zone = nearestOb || nearestFvg;
  const atr = averageTrueRange(fiveCandles);
  const slBuffer = atr * 0.35;
  const isTrendy = regime === "trendy";

  let entry, sl, tp, rr;
  if (bias === "bullish") {
    entry = zone.bottom;
    sl = entry - slBuffer;
    const risk = entry - sl;
    rr = 1.5;
    if (isTrendy) {
      rr = opposingLiquidity && opposingLiquidity > entry ? Math.min(5, Math.max(2, (opposingLiquidity - entry) / risk)) : 3;
    }
    tp = entry + risk * rr;
  } else {
    entry = zone.top;
    sl = entry + slBuffer;
    const risk = sl - entry;
    rr = 1.5;
    if (isTrendy) {
      rr = opposingLiquidity && opposingLiquidity < entry ? Math.min(5, Math.max(2, (entry - opposingLiquidity) / risk)) : 3;
    }
    tp = entry - risk * rr;
  }

  return {
    ...baseResult, action: "entry",
    setupName: nearestOb ? "Order Block entry" : "FVG entry",
    setupReason: `no named setup fired — entered at the ${bias === "bullish" ? "lowest" : "highest"} level of the ${nearestOb ? "order block" : "FVG"} (${regime} regime)`,
    entry, sl, tp, riskRewardRatio: Math.round(rr * 100) / 100,
  };
}
