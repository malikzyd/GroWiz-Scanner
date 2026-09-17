// src/lib/analyzePairFull.js
import { classifyStructure, getKeyLevels } from "./marketStructure";
import { findFVGs, findOrderBlocks, estimateMarketMakerPhase, nearestByPrice } from "./ictLevels";
import { findEntrySetup, buildLevelsFromSetup } from "./ictSetups";
import { getCached, setCached, CACHE_TTL } from "./cache";

// fetchers: { fetchDaily, fetchFourHour, fetchOneHour, fetchEntry } — each
// (symbol) => Promise<candles>, already wired to the right data source
// (Binance vs the Twelve Data proxy) by the caller.
export async function analyzePairFull({ symbol, market, fetchers, entryTimeframe }) {
  // --- Step 1: Daily bias (cached — doesn't need refetching every scan) ---
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
      dailyBias: daily.trend, intradayDirection: null,
      supportResistance: getKeyLevels(dailyCandles),
    };
  }

  // --- Step 2: 4H direction (cached) — must align with daily bias ---
  const fourHCacheKey = `4h:${symbol}`;
  let fourHCandles = getCached(fourHCacheKey, CACHE_TTL.fourHour);
  if (!fourHCandles) {
    try {
      fourHCandles = await fetchers.fetchFourHour(symbol);
      setCached(fourHCacheKey, fourHCandles);
    } catch (err) {
      return { symbol, market, error: `4H fetch failed: ${err.message}`, dailyBias: daily.trend };
    }
  }
  const fourH = classifyStructure(fourHCandles, "4H");

  const aligned = fourH.trend === daily.trend;
  if (!aligned) {
    return {
      symbol, market, action: "wait",
      waitReason: `4H (${fourH.trend}) not aligned with daily bias (${daily.trend}) — waiting`,
      dailyBias: daily.trend, intradayDirection: fourH.trend,
      supportResistance: getKeyLevels(dailyCandles),
    };
  }

  const bias = daily.trend; // confirmed on both daily and 4H

  // --- Step 3: 1H levels (only fetched once daily+4H agree — saves calls) ---
  let oneHCandles;
  try {
    oneHCandles = await fetchers.fetchOneHour(symbol);
  } catch (err) {
    return { symbol, market, error: `1H fetch failed: ${err.message}`, dailyBias: bias, intradayDirection: fourH.state };
  }
  const oneHFvgs = findFVGs(oneHCandles).filter((f) => f.type === bias);
  const oneHObs = findOrderBlocks(oneHCandles).filter((o) => o.type === bias);
  const lastClose1h = oneHCandles[oneHCandles.length - 1].close;
  const nearestOb = nearestByPrice(oneHObs, lastClose1h, (o) => (o.top + o.bottom) / 2);
  const nearestFvg = nearestByPrice(oneHFvgs, lastClose1h, (f) => (f.top + f.bottom) / 2);
  const mmPhase = estimateMarketMakerPhase(oneHCandles);
  const keyLevels = getKeyLevels(oneHCandles);

  // --- Step 4: entry setup on the chosen entry timeframe (5min or 15min) ---
  let entryCandles;
  try {
    entryCandles = await fetchers.fetchEntry(symbol);
  } catch (err) {
    return {
      symbol, market, action: "wait",
      waitReason: `entry timeframe fetch failed: ${err.message}`,
      dailyBias: bias, intradayDirection: fourH.state,
      supportResistance: keyLevels,
      orderBlock: nearestOb ? { ...nearestOb, price: (nearestOb.top + nearestOb.bottom) / 2 } : null,
      fvg: nearestFvg ? { ...nearestFvg, price: (nearestFvg.top + nearestFvg.bottom) / 2 } : null,
      marketMakerPhase: mmPhase.phase,
    };
  }

  const candidate = findEntrySetup(entryCandles, bias);

  const baseResult = {
    symbol, market, entryTimeframe,
    dailyBias: bias,
    intradayDirection: `${fourH.trend}/${fourH.state}`,
    displayBias: `Daily/Intraday = ${daily.trend}/${fourH.trend}`,
    supportResistance: keyLevels,
    orderBlock: nearestOb ? { ...nearestOb, price: (nearestOb.top + nearestOb.bottom) / 2 } : null,
    fvg: nearestFvg ? { ...nearestFvg, price: (nearestFvg.top + nearestFvg.bottom) / 2 } : null,
    marketMakerPhase: mmPhase.phase,
    premiumDiscount: fourH.premiumDiscount,
  };

  if (!candidate) {
    return { ...baseResult, action: "wait", waitReason: "no qualifying ICT entry setup found on entry timeframe yet" };
  }

  const levels = buildLevelsFromSetup(candidate, entryCandles);

  return {
    ...baseResult,
    action: "entry",
    setupName: candidate.setup,
    setupReason: candidate.reason,
    entry: levels.entry,
    sl: levels.sl,
    tp: levels.tp,
    riskRewardRatio: levels.riskRewardRatio,
  };
}
