// src/lib/ictSetups.js
//
// Each function checks one named setup against the entry-timeframe candles
// and returns a candidate { setup, direction, entry, sl, tp, reason } or
// null. Only candidates matching the already-confirmed daily+4H bias are
// used (filtering happens in analyzePairFull.js) — these implement the
// publicly documented mechanics of each setup, not a specific paid
// course's proprietary material.

import { findFVGs, averageTrueRange } from "./ictLevels";
import { findSwings } from "./marketStructure";

function lastCandle(candles) {
  return candles[candles.length - 1];
}

// Silver Bullet: a specific 1-hour session window (commonly 10-11am NY,
// or the London/Asian equivalents) where price forms an FVG that gets
// used as the entry. Simplified here to: is price currently inside one of
// the commonly-cited Silver Bullet windows AND is there a fresh FVG in
// bias direction within the last few candles.
function silverBullet(candles, bias) {
  const now = new Date();
  const h = now.getUTCHours();
  const inWindow = (h >= 14 && h < 15) || (h >= 3 && h < 4) || (h >= 19 && h < 20); // NY AM / London / NY PM (UTC approx)
  if (!inWindow) return null;

  const fvgs = findFVGs(candles).filter((f) => f.type === bias);
  const recentFvg = fvgs.slice(-1)[0];
  if (!recentFvg || recentFvg.index < candles.length - 6) return null;

  const entry = (recentFvg.top + recentFvg.bottom) / 2;
  return { setup: "Silver Bullet", direction: bias, entry, zoneTop: recentFvg.top, zoneBottom: recentFvg.bottom, reason: "FVG formed inside Silver Bullet window" };
}

// Liquidity Sweep + Market Structure Shift (MSS): price sweeps a recent
// swing extreme then breaks structure back in the bias direction.
function liquiditySweepMSS(candles, bias) {
  const { highs, lows } = findSwings(candles);
  const last = lastCandle(candles);
  const recentHigh = highs.slice(-1)[0];
  const recentLow = lows.slice(-1)[0];

  if (bias === "bullish" && recentLow && last.low < recentLow.price && last.close > recentLow.price) {
    // swept low, closed back above — check for a subsequent break above the last lower high (MSS)
    const priorHigh = highs.slice(-2, -1)[0];
    if (priorHigh && last.close > priorHigh.price) {
      return { setup: "Liquidity Sweep + MSS", direction: "bullish", entry: last.close, zoneTop: null, zoneBottom: recentLow.price, reason: "swept sell-side liquidity then broke structure up" };
    }
  }
  if (bias === "bearish" && recentHigh && last.high > recentHigh.price && last.close < recentHigh.price) {
    const priorLow = lows.slice(-2, -1)[0];
    if (priorLow && last.close < priorLow.price) {
      return { setup: "Liquidity Sweep + MSS", direction: "bearish", entry: last.close, zoneTop: recentHigh.price, zoneBottom: null, reason: "swept buy-side liquidity then broke structure down" };
    }
  }
  return null;
}

// Turtle Soup: a false breakout of a recent (e.g. prior session) high/low
// that immediately reverses — same underlying mechanic as a liquidity
// sweep but specifically framed around a clean prior extreme with a sharp
// rejection candle.
function turtleSoup(candles, bias) {
  const { highs, lows } = findSwings(candles);
  const last = lastCandle(candles);
  const priorHigh = highs.slice(-2, -1)[0];
  const priorLow = lows.slice(-2, -1)[0];
  const bodyPct = Math.abs(last.close - last.open) / Math.max(last.high - last.low, 1e-9);

  if (bias === "bullish" && priorLow && last.low < priorLow.price && last.close > priorLow.price && bodyPct > 0.4) {
    return { setup: "Turtle Soup", direction: "bullish", entry: last.close, zoneBottom: priorLow.price, reason: "false breakdown below prior low, sharp reversal candle" };
  }
  if (bias === "bearish" && priorHigh && last.high > priorHigh.price && last.close < priorHigh.price && bodyPct > 0.4) {
    return { setup: "Turtle Soup", direction: "bearish", entry: last.close, zoneTop: priorHigh.price, reason: "false breakout above prior high, sharp reversal candle" };
  }
  return null;
}

// Optimal Trade Entry (OTE): retracement into the 61.8%-79% zone of the
// most recent impulse leg, in the direction of bias.
function optimalTradeEntry(candles, bias) {
  const { highs, lows } = findSwings(candles);
  const recentHigh = highs.slice(-1)[0];
  const recentLow = lows.slice(-1)[0];
  if (!recentHigh || !recentLow) return null;

  const last = lastCandle(candles);
  const range = recentHigh.price - recentLow.price;
  if (range <= 0) return null;

  if (bias === "bullish" && recentHigh.index > recentLow.index) {
    // impulse was up (low then high) — OTE zone is a pullback from the high
    const oteTop = recentHigh.price - range * 0.618;
    const oteBottom = recentHigh.price - range * 0.79;
    if (last.low <= oteTop && last.close >= oteBottom) {
      return { setup: "OTE", direction: "bullish", entry: (oteTop + oteBottom) / 2, zoneTop: oteTop, zoneBottom: oteBottom, reason: "price retraced into 61.8%-79% OTE zone of the up-leg" };
    }
  }
  if (bias === "bearish" && recentLow.index > recentHigh.index) {
    const oteBottom = recentLow.price + range * 0.618;
    const oteTop = recentLow.price + range * 0.79;
    if (last.high >= oteBottom && last.close <= oteTop) {
      return { setup: "OTE", direction: "bearish", entry: (oteTop + oteBottom) / 2, zoneTop: oteTop, zoneBottom: oteBottom, reason: "price retraced into 61.8%-79% OTE zone of the down-leg" };
    }
  }
  return null;
}

// Power of 3 / AMD: Accumulation (range), Manipulation (sweep beyond the
// range), Distribution (trending move away) — checked within the current
// session's candles.
function powerOfThree(candles, bias) {
  if (candles.length < 20) return null;
  const session = candles.slice(-20);
  const accumulation = session.slice(0, 8);
  const rest = session.slice(8);
  const accHigh = Math.max(...accumulation.map((c) => c.high));
  const accLow = Math.min(...accumulation.map((c) => c.low));
  const last = lastCandle(candles);

  const manipulated = rest.some((c) => c.high > accHigh || c.low < accLow);
  if (!manipulated) return null;

  if (bias === "bullish" && last.close > accHigh) {
    return { setup: "Power of 3 (AMD)", direction: "bullish", entry: last.close, zoneBottom: accLow, reason: "swept accumulation range low, now distributing upward" };
  }
  if (bias === "bearish" && last.close < accLow) {
    return { setup: "Power of 3 (AMD)", direction: "bearish", entry: last.close, zoneTop: accHigh, reason: "swept accumulation range high, now distributing downward" };
  }
  return null;
}

// Opening Range Gap: a gap between the prior session's close and the
// current session's open; price returning toward the gap and rejecting
// it in bias direction.
function openingRangeGap(candles, bias) {
  if (candles.length < 5) return null;
  const last = lastCandle(candles);
  const sessionOpenIdx = candles.length - Math.min(candles.length, 12); // approx recent session window
  const sessionOpen = candles[sessionOpenIdx];
  const priorClose = candles[Math.max(0, sessionOpenIdx - 1)];
  if (!sessionOpen || !priorClose) return null;

  const gapUp = sessionOpen.open > priorClose.close * 1.0005;
  const gapDown = sessionOpen.open < priorClose.close * 0.9995;

  if (bias === "bullish" && gapDown && last.low <= priorClose.close && last.close > priorClose.close) {
    return { setup: "Opening Range Gap", direction: "bullish", entry: last.close, zoneBottom: priorClose.close, reason: "filled and rejected the opening gap down" };
  }
  if (bias === "bearish" && gapUp && last.high >= priorClose.close && last.close < priorClose.close) {
    return { setup: "Opening Range Gap", direction: "bearish", entry: last.close, zoneTop: priorClose.close, reason: "filled and rejected the opening gap up" };
  }
  return null;
}

// Judas Swing: a fakeout move at/near a session open that quickly
// reverses back through the open price — commonly grouped with the other
// session-timing setups above.
function judasSwing(candles, bias) {
  if (candles.length < 8) return null;
  const sessionOpenIdx = candles.length - 8;
  const sessionOpen = candles[sessionOpenIdx];
  const last = lastCandle(candles);
  const sinceOpen = candles.slice(sessionOpenIdx);
  const openPrice = sessionOpen.open;

  const fakeoutUp = Math.max(...sinceOpen.map((c) => c.high)) > openPrice * 1.0008;
  const fakeoutDown = Math.min(...sinceOpen.map((c) => c.low)) < openPrice * 0.9992;

  if (bias === "bullish" && fakeoutDown && last.close > openPrice) {
    return { setup: "Judas Swing", direction: "bullish", entry: last.close, zoneBottom: Math.min(...sinceOpen.map((c) => c.low)), reason: "fakeout below session open reversed back above it" };
  }
  if (bias === "bearish" && fakeoutUp && last.close < openPrice) {
    return { setup: "Judas Swing", direction: "bearish", entry: last.close, zoneTop: Math.max(...sinceOpen.map((c) => c.high)), reason: "fakeout above session open reversed back below it" };
  }
  return null;
}

// Runs all 7, returns the first candidate matching the confirmed bias
// (order = rough priority; adjust if you want a different preference).
export function findEntrySetup(candles, bias) {
  const checks = [silverBullet, liquiditySweepMSS, turtleSoup, optimalTradeEntry, powerOfThree, openingRangeGap, judasSwing];
  for (const check of checks) {
    const result = check(candles, bias);
    if (result) return result;
  }
  return null;
}

// Builds final entry/SL/TP from a matched setup candidate — SL kept a
// little wider ("a lil safer" per your spec). TP sizing depends on daily
// regime: sideways/pullback keeps trades short (1:1.5); trendy targets
// 1:2 to 1:5, reaching toward the nearest opposing liquidity level when
// available, otherwise defaulting to 1:3.
export function buildLevelsFromSetup(candidate, candles, regime = "sideways", opposingLiquidity = null) {
  const atr = averageTrueRange(candles);
  const slBuffer = atr * 0.35;

  let sl, entry;
  entry = candidate.entry;

  const isTrendy = regime === "trendy";

  if (candidate.direction === "bullish") {
    sl = (candidate.zoneBottom ?? entry - atr) - slBuffer;
    const risk = entry - sl;
    let rr = 1.5;
    let tp = entry + risk * 1.5;
    if (isTrendy) {
      rr = 3;
      if (opposingLiquidity && opposingLiquidity > entry) {
        const impliedRR = (opposingLiquidity - entry) / risk;
        rr = Math.min(5, Math.max(2, impliedRR));
      }
      tp = entry + risk * rr;
    }
    return { entry, sl, tp, riskRewardRatio: Math.round(rr * 100) / 100 };
  } else {
    sl = (candidate.zoneTop ?? entry + atr) + slBuffer;
    const risk = sl - entry;
    let rr = 1.5;
    let tp = entry - risk * 1.5;
    if (isTrendy) {
      rr = 3;
      if (opposingLiquidity && opposingLiquidity < entry) {
        const impliedRR = (entry - opposingLiquidity) / risk;
        rr = Math.min(5, Math.max(2, impliedRR));
      }
      tp = entry - risk * rr;
    }
    return { entry, sl, tp, riskRewardRatio: Math.round(rr * 100) / 100 };
  }
}
