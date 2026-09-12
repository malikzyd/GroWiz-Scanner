// src/lib/smcEngine.js
//
// All detection here is standard, well-documented ICT/SMC technical analysis
// run against real (or estimated, see dataFeeds.js) candle data pulled live
// for each pair. Nothing here claims access to broker order books or
// institutional flow — it's pattern detection on price/volume, same category
// as every RSI or MACD indicator, just applied to SMC concepts instead.

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

// BRM = "buy-side retail money" -> liquidity resting ABOVE recent swing highs
//        (breakout buy-stops / retail longs' take-profits cluster here)
// SRM = "sell-side retail money" -> liquidity resting BELOW recent swing lows
//        (breakout sell-stops / retail shorts' take-profits cluster here)
// Equal-highs/lows within `tolerancePct` are treated as one clustered pool
// (bigger pools = more resting liquidity = more attractive sweep target).
function findLiquidityPools(swingPoints, tolerancePct = 0.05) {
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
      strength: c.length, // how many swings clustered here = pool size
      lastTouch: Math.max(...c.map((p) => p.time)),
    }))
    .sort((a, b) => b.strength - a.strength);
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

// Drop FVGs price has already fully traded back through (i.e. "filled").
function unfilledFVGs(fvgs, candles) {
  return fvgs.filter((fvg) => {
    const after = candles.slice(fvg.index + 1);
    return !after.some((c) => c.low <= fvg.bottom && c.high >= fvg.top);
  });
}

// ---------- Order blocks ----------
// Simplified, common definition:
// Bullish OB = last down-close candle before an impulsive up move that
//              breaks above the prior swing high (structure break).
// Bearish OB = last up-close candle before an impulsive down move that
//              breaks below the prior swing low.

function findOrderBlocks(candles, swingHighs, swingLows, impulseAtrMult = 1.5) {
  const obs = [];
  const atr = averageTrueRange(candles);

  for (let i = 5; i < candles.length - 1; i++) {
    const move = candles[i + 1].close - candles[i].close;
    const isImpulse = Math.abs(move) > atr * impulseAtrMult;
    if (!isImpulse) continue;

    if (move > 0) {
      // look back for the last down-close candle before this impulse
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (candles[j].close < candles[j].open) {
          const brokeStructure = swingHighs.some(
            (sh) => sh.index < j && candles[i + 1].high > sh.price
          );
          if (brokeStructure) {
            obs.push({
              type: "bullish",
              top: candles[j].high,
              bottom: candles[j].low,
              index: j,
              time: candles[j].time,
            });
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
            obs.push({
              type: "bearish",
              top: candles[j].high,
              bottom: candles[j].low,
              index: j,
              time: candles[j].time,
            });
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
    trs.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
}

// ---------- Kill zones (session windows, UTC) ----------

export function getActiveKillZone(date = new Date()) {
  const h = date.getUTCHours();
  if (h >= 0 && h < 6) return { name: "Asian", active: true };
  if (h >= 7 && h < 10) return { name: "London", active: true };
  if (h >= 12 && h < 15) return { name: "New York", active: true };
  if (h >= 10 && h < 12) return { name: "London/NY overlap approach", active: false };
  return { name: "Off-session", active: false };
}

// ---------- Master analysis per pair ----------

export function analyzePair({ symbol, market, candles, timeframe }) {
  if (!candles || candles.length < 30) {
    return { symbol, market, error: "not enough candles" };
  }

  const { swingHighs, swingLows } = findSwingPoints(candles);
  const brmPools = findLiquidityPools(swingHighs); // above price = buy-side resting liquidity
  const srmPools = findLiquidityPools(swingLows); // below price = sell-side resting liquidity

  const allFVGs = unfilledFVGs(findFVGs(candles), candles);
  const allOBs = unmitigatedOBs(findOrderBlocks(candles, swingHighs, swingLows), candles);

  const lastClose = candles[candles.length - 1].close;
  const atr = averageTrueRange(candles);

  const nearestFVG = nearestByPrice(allFVGs, lastClose, (f) => (f.top + f.bottom) / 2);
  const nearestOB = nearestByPrice(allOBs, lastClose, (o) => (o.top + o.bottom) / 2);
  const nearestBRM = nearestByPrice(brmPools, lastClose, (p) => p.price, "above");
  const nearestSRM = nearestByPrice(srmPools, lastClose, (p) => p.price, "below");

  // Recent volume/delta snapshot (real for crypto, estimated for fx/commodities)
  const recent = candles.slice(-10);
  const buySum = recent.reduce((s, c) => s + (c.buyVolume || 0), 0);
  const sellSum = recent.reduce((s, c) => s + (c.sellVolume || 0), 0);
  const volumeIsEstimated = recent.some((c) => c.volumeIsEstimated);

  const bias = determineBias({ nearestOB, nearestFVG, buySum, sellSum });
  const killZone = getActiveKillZone();

  const { entry, sl, tp } = buildTradeLevels({
    bias,
    lastClose,
    atr,
    nearestOB,
    nearestFVG,
    nearestBRM,
    nearestSRM,
  });

  const score = scorePair({
    nearestOB,
    nearestFVG,
    lastClose,
    atr,
    killZoneActive: killZone.active,
    poolStrength: Math.max(nearestBRM?.strength || 0, nearestSRM?.strength || 0),
  });

  return {
    symbol,
    market,
    timeframe,
    lastClose,
    bias,
    score,
    killZone,
    volumeIsEstimated,
    buyVolume: buySum,
    sellVolume: sellSum,
    orderBlock: nearestOB ? { ...nearestOB, price: (nearestOB.top + nearestOB.bottom) / 2 } : null,
    fvg: nearestFVG ? { ...nearestFVG, price: (nearestFVG.top + nearestFVG.bottom) / 2 } : null,
    brm: nearestBRM,
    srm: nearestSRM,
    entry,
    sl,
    tp,
  };
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

function determineBias({ nearestOB, nearestFVG, buySum, sellSum }) {
  let bullScore = 0;
  let bearScore = 0;
  if (nearestOB?.type === "bullish") bullScore++;
  if (nearestOB?.type === "bearish") bearScore++;
  if (nearestFVG?.type === "bullish") bullScore++;
  if (nearestFVG?.type === "bearish") bearScore++;
  if (buySum > sellSum) bullScore++;
  else if (sellSum > buySum) bearScore++;

  if (bullScore === bearScore) return "neutral";
  return bullScore > bearScore ? "bullish" : "bearish";
}

function buildTradeLevels({ bias, lastClose, atr, nearestOB, nearestFVG, nearestBRM, nearestSRM }) {
  if (bias === "neutral") return { entry: null, sl: null, tp: null };

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

// Confluence score used to rank pairs and pick the top 3. Purely a function
// of how many SMC factors line up + whether we're inside an active kill
// zone — not a probability or a guarantee of any outcome.
function scorePair({ nearestOB, nearestFVG, lastClose, atr, killZoneActive, poolStrength }) {
  let score = 0;
  if (nearestOB) {
    const dist = Math.abs((nearestOB.top + nearestOB.bottom) / 2 - lastClose);
    score += Math.max(0, 3 - dist / atr); // closer OB = higher score, capped
  }
  if (nearestFVG) {
    const dist = Math.abs((nearestFVG.top + nearestFVG.bottom) / 2 - lastClose);
    score += Math.max(0, 2 - dist / atr);
  }
  if (nearestOB && nearestFVG && nearestOB.type === nearestFVG.type) {
    score += 2; // OB + FVG agreeing on direction = confluence bonus
  }
  score += Math.min(poolStrength, 3) * 0.5; // bigger liquidity pool nearby
  if (killZoneActive) score += 1.5;
  return Math.round(score * 100) / 100;
}

export function rankTopPairs(analyses, count = 3) {
  return analyses
    .filter((a) => !a.error && a.bias !== "neutral")
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
