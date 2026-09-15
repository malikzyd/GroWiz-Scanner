// src/lib/smcEngine.js
//
// Detection is standard, documented ICT/SMC technical analysis run against
// real (or estimated — see dataFeeds.js) candle data. Nothing here claims
// access to broker order books or institutional flow.
//
// NEW in this version: entries are only returned when the intraday signal
// agrees with the pair's DAILY bias (real market structure — HH/HL vs
// LH/LL) and doesn't conflict with DXY direction. When it doesn't align,
// the pair still returns its support/resistance, order block, and FVG
// levels — just with action: "wait" instead of a trade.

// ---------- Swing points & liquidity (BRM / SRM) ----------

function findSwingPoints(candles, lookback = 3) {
  const swingHighs = [];
  const swingLows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const c = candles[i];
    if (c.high === Math.max(...window.map((w) => w.high))) {
      swingHighs.push({ index: i, price: c.high, time: c.time });
    }
    if (c.low === Math.min(...window.map((w) => w.low))) {
      swingLows.push({ index: i, price: c.low, time: c.time });
    }
  }
  return { swingHighs, swingLows };
}

function findLiquidityPools(swingPoints, tolerancePct = 0.05) {
  if (swingPoints.length === 0) return [];
  const pools = [];
  const sorted = [...swingPoints].sort((a, b) => a.price - b.price);
  let cluster = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cluster[cluster.length - 1];
    const pctDiff = (Math.abs(sorted[i].price - prev.price) / prev.price) * 100;
    if (pctDiff <= tolerancePct) {
      cluster.push(sorted[i]);
    } else {
      pools.push(cluster);
      cluster = [sorted[i]];
    }
  }
  pools.push(cluster);
  return pools
    .map((c) => ({
      price: c.reduce((s, p) => s + p.price, 0) / c.length,
      strength: c.length,
      lastTouch: Math.max(...c.map((p) => p.time)),
    }))
    .sort((a, b) => b.strength - a.strength);
}

// ---------- Liquidity sweep detection ----------
// A recognized public ICT pattern: price briefly breaks a prior swing
// high/low (sweeping resting liquidity/stops) then closes back inside the
// prior range — often precedes a reversal in the swept direction's opposite.
function detectLiquiditySweep(candles, swingHighs, swingLows) {
  const last = candles[candles.length - 1];
  const recentHigh = swingHighs.slice(-1)[0];
  const recentLow = swingLows.slice(-1)[0];

  if (recentHigh && last.high > recentHigh.price && last.close < recentHigh.price) {
    return { type: "bearish", sweptLevel: recentHigh.price };
  }
  if (recentLow && last.low < recentLow.price && last.close > recentLow.price) {
    return { type: "bullish", sweptLevel: recentLow.price };
  }
  return null;
}

// ---------- Fair Value Gaps ----------

function findFVGs(candles) {
  const fvgs = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c1.high < c3.low) {
      fvgs.push({ type: "bullish", top: c3.low, bottom: c1.high, index: i, time: c3.time });
    }
    if (c1.low > c3.high) {
      fvgs.push({ type: "bearish", top: c1.low, bottom: c3.high, index: i, time: c3.time });
    }
  }
  return fvgs;
}

function unfilledFVGs(fvgs, candles) {
  return fvgs.filter((fvg) => {
    const after = candles.slice(fvg.index + 1);
    return !after.some((c) => c.low <= fvg.bottom && c.high >= fvg.top);
  });
}

// ---------- Order blocks ----------

function findOrderBlocks(candles, swingHighs, swingLows, impulseAtrMult = 1.5) {
  const obs = [];
  const atr = averageTrueRange(candles);

  for (let i = 5; i < candles.length - 1; i++) {
    const move = candles[i + 1].close - candles[i].close;
    const isImpulse = Math.abs(move) > atr * impulseAtrMult;
    if (!isImpulse) continue;

    if (move > 0) {
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (candles[j].close < candles[j].open) {
          const brokeStructure = swingHighs.some(
            (sh) => sh.index < j && candles[i + 1].high > sh.price
          );
          if (brokeStructure) {
            obs.push({ type: "bullish", top: candles[j].high, bottom: candles[j].low, index: j, time: candles[j].time });
          }
          break;
        }
      }
    } else {
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (candles[j].close > candles[j].open) {
          const brokeStructure = swingLows.some(
            (sl) => sl.index < j && candles[i + 1].low < sl.price
          );
          if (brokeStructure) {
            obs.push({ type: "bearish", top: candles[j].high, bottom: candles[j].low, index: j, time: candles[j].time });
          }
          break;
        }
      }
    }
  }
  return obs;
}

function unmitigatedOBs(obs, candles) {
  return obs.filter((ob) => {
    const after = candles.slice(ob.index + 1);
    if (ob.type === "bullish") return !after.some((c) => c.low < ob.bottom);
    return !after.some((c) => c.high > ob.top);
  });
}

function averageTrueRange(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
}

// ---------- Kill zones ----------

export function getActiveKillZone(date = new Date()) {
  const h = date.getUTCHours();
  if (h >= 0 && h < 6) return { name: "Asian", active: true };
  if (h >= 7 && h < 10) return { name: "London", active: true };
  if (h >= 12 && h < 15) return { name: "New York", active: true };
  if (h >= 10 && h < 12) return { name: "London/NY overlap approach", active: false };
  return { name: "Off-session", active: false };
}

function nearestByPrice(items, refPrice, getPrice, side = "either") {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    const p = getPrice(item);
    if (side === "above" && p <= refPrice) continue;
    if (side === "below" && p >= refPrice) continue;
    const d = Math.abs(p - refPrice);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

function determineIntradayBias({ nearestOB, nearestFVG, buySum, sellSum, sweep }) {
  let bullScore = 0;
  let bearScore = 0;
  if (nearestOB?.type === "bullish") bullScore++;
  if (nearestOB?.type === "bearish") bearScore++;
  if (nearestFVG?.type === "bullish") bullScore++;
  if (nearestFVG?.type === "bearish") bearScore++;
  if (buySum > sellSum) bullScore++;
  else if (sellSum > buySum) bearScore++;
  if (sweep?.type === "bullish") bullScore += 1.5;
  if (sweep?.type === "bearish") bearScore += 1.5;

  if (bullScore === bearScore) return "neutral";
  return bullScore > bearScore ? "bullish" : "bearish";
}

function buildTradeLevels({ bias, nearestOB, nearestFVG, nearestBRM, nearestSRM, atr }) {
  const zone = nearestOB || nearestFVG;
  if (!zone) return { entry: null, sl: null, tp: null };
  const zoneMid = (zone.top + zone.bottom) / 2;

  if (bias === "bullish") {
    return {
      entry: zoneMid,
      sl: zone.bottom - atr * 0.25,
      tp: nearestBRM ? nearestBRM.price : zoneMid + atr * 4,
    };
  }
  return {
    entry: zoneMid,
    sl: zone.top + atr * 0.25,
    tp: nearestSRM ? nearestSRM.price : zoneMid - atr * 4,
  };
}

function scorePair({ nearestOB, nearestFVG, lastClose, atr, killZoneActive, poolStrength, dailyAligned, dxyAlignment, sweep }) {
  let score = 0;
  if (nearestOB) score += Math.max(0, 3 - Math.abs((nearestOB.top + nearestOB.bottom) / 2 - lastClose) / atr);
  if (nearestFVG) score += Math.max(0, 2 - Math.abs((nearestFVG.top + nearestFVG.bottom) / 2 - lastClose) / atr);
  if (nearestOB && nearestFVG && nearestOB.type === nearestFVG.type) score += 2;
  score += Math.min(poolStrength, 3) * 0.5;
  if (killZoneActive) score += 1.5;
  if (dailyAligned) score += 2.5; // daily bias confluence is weighted heavily on purpose
  if (dxyAlignment === "aligned") score += 1.5;
  if (dxyAlignment === "conflicting") score -= 2;
  if (sweep) score += 1;
  return Math.round(score * 100) / 100;
}

// ---------- Master analysis per pair ----------
//
// dailyBias: { bias: "bullish"|"bearish"|"ranging"|"unknown", reason }
// dxyAlignment: "aligned" | "conflicting" | "neutral"
// keyLevels: { support, resistance } from the daily timeframe
// highImpactNewsToday: boolean — a high-impact event today for this pair's currency
export function analyzePair({ symbol, market, candles, timeframe, dailyBias, dxyAlignment, keyLevels, highImpactNewsToday }) {
  if (!candles || candles.length < 30) {
    return { symbol, market, error: "not enough candles" };
  }

  const { swingHighs, swingLows } = findSwingPoints(candles);
  const brmPools = findLiquidityPools(swingHighs);
  const srmPools = findLiquidityPools(swingLows);
  const allFVGs = unfilledFVGs(findFVGs(candles), candles);
  const allOBs = unmitigatedOBs(findOrderBlocks(candles, swingHighs, swingLows), candles);
  const sweep = detectLiquiditySweep(candles, swingHighs, swingLows);

  const lastClose = candles[candles.length - 1].close;
  const atr = averageTrueRange(candles);

  const nearestFVG = nearestByPrice(allFVGs, lastClose, (f) => (f.top + f.bottom) / 2);
  const nearestOB = nearestByPrice(allOBs, lastClose, (o) => (o.top + o.bottom) / 2);
  const nearestBRM = nearestByPrice(brmPools, lastClose, (p) => p.price, "above");
  const nearestSRM = nearestByPrice(srmPools, lastClose, (p) => p.price, "below");

  const recent = candles.slice(-10);
  const buySum = recent.reduce((s, c) => s + (c.buyVolume || 0), 0);
  const sellSum = recent.reduce((s, c) => s + (c.sellVolume || 0), 0);
  const volumeIsEstimated = recent.some((c) => c.volumeIsEstimated);

  const intradayBias = determineIntradayBias({ nearestOB, nearestFVG, buySum, sellSum, sweep });
  const killZone = getActiveKillZone();

  // --- Gating logic: only allow a trade if it agrees with daily bias and
  // doesn't conflict with DXY. Otherwise: "wait", but still show levels.
  const dBias = dailyBias?.bias || "unknown";
  const dailyAligned = dBias !== "unknown" && dBias !== "ranging" && dBias === intradayBias;
  const dxyBlocks = dxyAlignment === "conflicting";

  let action = "wait";
  let waitReason = null;
  if (intradayBias === "neutral") {
    waitReason = "no clear intraday signal";
  } else if (dBias === "unknown" || dBias === "ranging") {
    waitReason = `daily bias unclear (${dailyBias?.reason || "insufficient daily data"}) — showing levels only`;
  } else if (!dailyAligned) {
    waitReason = `intraday signal (${intradayBias}) is against daily bias (${dBias}) — waiting for alignment`;
  } else if (dxyBlocks) {
    waitReason = "conflicts with current DXY direction";
  } else {
    action = "entry";
  }

  const { entry, sl, tp } =
    action === "entry"
      ? buildTradeLevels({ bias: intradayBias, nearestOB, nearestFVG, nearestBRM, nearestSRM, atr })
      : { entry: null, sl: null, tp: null };

  const score = scorePair({
    nearestOB,
    nearestFVG,
    lastClose,
    atr,
    killZoneActive: killZone.active,
    poolStrength: Math.max(nearestBRM?.strength || 0, nearestSRM?.strength || 0),
    dailyAligned,
    dxyAlignment,
    sweep,
  });

  return {
    symbol,
    market,
    timeframe,
    lastClose,
    action, // "entry" | "wait"
    waitReason,
    intradayBias,
    dailyBias: dBias,
    dxyAlignment: dxyAlignment || "neutral",
    highImpactNewsToday: !!highImpactNewsToday,
    score,
    killZone,
    volumeIsEstimated,
    buyVolume: buySum,
    sellVolume: sellSum,
    supportResistance: keyLevels || null,
    orderBlock: nearestOB ? { ...nearestOB, price: (nearestOB.top + nearestOB.bottom) / 2 } : null,
    fvg: nearestFVG ? { ...nearestFVG, price: (nearestFVG.top + nearestFVG.bottom) / 2 } : null,
    brm: nearestBRM,
    srm: nearestSRM,
    liquiditySweep: sweep,
    entry,
    sl,
    tp,
  };
}

export function rankTopPairs(analyses, count = 3) {
  return analyses
    .filter((a) => !a.error && a.action === "entry")
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
