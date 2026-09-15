import React, { useEffect, useState, useCallback } from "react";
import { ALL_PAIRS } from "../lib/pairs";
import {
  fetchCryptoCandles,
  fetchBinanceCommodityCandles,
  fetchForexCandles,
  fetchBatch,
} from "../lib/dataFeeds";
import { analyzePair, rankTopPairs, getActiveKillZone } from "../lib/smcEngine";
import { getDailyBias, getKeyLevels } from "../lib/dailyBias";
import { getDxyBias, getDxyAlignment } from "../lib/dxyEngine";
import { getTodaysHighImpactCurrencies, pairTouchesHighImpactNews } from "../lib/fundamentals";

const TIMEFRAMES = ["5min", "15min", "1h"];

const COLORS = {
  bg: "#000000",
  panel: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.65)",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

async function fetchDailyCandles(pair) {
  if (pair.market === "crypto") return fetchCryptoCandles(pair.symbol, "1day", 60);
  if (pair.market === "commodity-binance") return fetchBinanceCommodityCandles(pair.symbol, "1day", 60);
  return fetchForexCandles(pair.symbol, "1day", 60);
}

export default function ScannerDashboard() {
  const [timeframe, setTimeframe] = useState("5min");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [lastRun, setLastRun] = useState(null);
  const [killZone, setKillZone] = useState(getActiveKillZone());
  const [dxyBias, setDxyBias] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setKillZone(getActiveKillZone()), 60_000);
    return () => clearInterval(t);
  }, []);

  const runScan = useCallback(async () => {
    setStatus("checking DXY + news");

    const dxy = await getDxyBias(fetchForexCandles);
    setDxyBias(dxy);
    const highImpactCurrencies = await getTodaysHighImpactCurrencies();

    const cryptoPairs = ALL_PAIRS.filter((p) => p.market === "crypto");
    const binanceCommodities = ALL_PAIRS.filter((p) => p.market === "commodity-binance");
    const proxyPairs = ALL_PAIRS.filter((p) => p.market === "forex" || p.market === "commodity-td");

    setStatus("scanning free pairs (crypto + gold/silver)");
    const freeResults = await Promise.all(
      [...cryptoPairs, ...binanceCommodities].map(async (p) => {
        try {
          const fetchFn = p.market === "crypto" ? fetchCryptoCandles : fetchBinanceCommodityCandles;
          const [candles, dailyCandles] = await Promise.all([
            fetchFn(p.symbol, timeframe),
            fetchDailyCandles(p),
          ]);
          const dailyBias = getDailyBias(dailyCandles);
          const keyLevels = getKeyLevels(dailyCandles);
          const dxyAlignment = getDxyAlignment(p.symbol, dailyBias.bias, dxy.bias);
          return analyzePair({
            symbol: p.symbol,
            market: p.market,
            candles,
            timeframe,
            dailyBias,
            dxyAlignment,
            keyLevels,
            highImpactNewsToday: pairTouchesHighImpactNews(p.symbol, highImpactCurrencies),
          });
        } catch (err) {
          return { symbol: p.symbol, market: p.market, error: err.message };
        }
      })
    );

    setStatus("scanning forex/oil/copper (paced)");
    const proxyRaw = await fetchBatch(
      proxyPairs.map((p) => p.symbol),
      (symbol) => fetchForexCandles(symbol, timeframe)
    );
    const proxyResults = await Promise.all(
      proxyPairs.map(async (p) => {
        const candles = proxyRaw[p.symbol];
        if (!candles || candles.error) {
          return { symbol: p.symbol, market: p.market, error: candles?.error || "fetch failed" };
        }
        try {
          const dailyCandles = await fetchDailyCandles(p);
          const dailyBias = getDailyBias(dailyCandles);
          const keyLevels = getKeyLevels(dailyCandles);
          const dxyAlignment = getDxyAlignment(p.symbol, dailyBias.bias, dxy.bias);
          return analyzePair({
            symbol: p.symbol,
            market: p.market,
            candles,
            timeframe,
            dailyBias,
            dxyAlignment,
            keyLevels,
            highImpactNewsToday: pairTouchesHighImpactNews(p.symbol, highImpactCurrencies),
          });
        } catch (err) {
          return { symbol: p.symbol, market: p.market, error: err.message };
        }
      })
    );

    setResults([...freeResults, ...proxyResults]);
    setLastRun(new Date());
    setStatus("idle");
  }, [timeframe]);

  const topThree = rankTopPairs(results, 3);
  const watchlist = results.filter((r) => !r.error).sort((a, b) => b.score - a.score);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <div style={{ textAlign: "center", padding: "32px 0 8px" }}>
          <img src="/IMG-20260912-WA9285.jpg" alt="GroWiz Scanner" style={{ width: 140, height: "auto", filter: "drop-shadow(0 0 18px rgba(34,197,94,0.35))" }} />
        </div>

        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, marginBottom: 6, color: COLORS.green }}>Live Scan</h1>
          <p style={{ fontSize: 13, color: COLORS.dim, maxWidth: 640, margin: "0 auto" }}>
            All market's insights in one click. Run alongside TradingView — this is a read-only
            overlay, not a broker or execution tool.
          </p>
        </header>

        <section style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>
            Timeframe:{" "}
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={{ background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
              {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </label>
          <button onClick={runScan} disabled={status !== "idle"} style={{ background: COLORS.green, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>
            {status !== "idle" ? status : "Run scan"}
          </button>
        </section>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <Badge label={`Session: ${killZone.name}${killZone.active ? " (active)" : ""}`} color={killZone.active ? COLORS.green : COLORS.dim} />
          {dxyBias && <Badge label={`DXY: ${dxyBias.bias}`} color={dxyBias.bias === "bullish" ? COLORS.green : dxyBias.bias === "bearish" ? COLORS.red : COLORS.dim} />}
          {lastRun && <Badge label={`Last scan ${lastRun.toLocaleTimeString()}`} color={COLORS.dim} />}
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Top 3 to trade</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
          {topThree.length === 0 && <p style={{ fontSize: 13, color: COLORS.dim }}>No pairs currently aligned across intraday + daily bias + DXY. Check the watchlist below for levels to watch.</p>}
          {topThree.map((r) => <PairCard key={r.symbol} r={r} highlighted />)}
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Full watchlist</h2>
        <div style={{ display: "grid", gap: 8, marginBottom: 40 }}>
          {watchlist.map((r) => <PairCard key={r.symbol} r={r} />)}
        </div>

        <footer style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 20, paddingBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Contact us, email: <a href="mailto:ghostgrower88@gmail.com" style={{ color: COLORS.blue }}>ghostgrower88@gmail.com</a>
          </div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            <a href="https://growizanalytics.lovable.app" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.blue }}>GroWiz Signal Generator</a>
          </div>
          <p style={{ fontSize: 11, color: COLORS.dim, maxWidth: 520, margin: "0 auto 10px" }}>
            Scans live markets via SMC, retail money levels, order flow, and volume.
          </p>
          <p style={{ fontSize: 10, color: COLORS.dim, maxWidth: 520, margin: "0 auto" }}>
            Scans the markets and gives you scanned analysis, not financial advice. Invest at your own risk.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color }}>
      {label}
    </span>
  );
}

function PairCard({ r, highlighted }) {
  const isEntry = r.action === "entry";
  const dirColor = r.intradayBias === "bullish" ? COLORS.green : r.intradayBias === "bearish" ? COLORS.red : COLORS.dim;

  return (
    <div style={{ border: highlighted ? `2px solid ${COLORS.green}` : `1px solid ${COLORS.border}`, background: COLORS.panel, borderRadius: 8, padding: 12, fontSize: 13, color: COLORS.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>{r.symbol}</strong>
        <span style={{ color: dirColor, textTransform: "capitalize", fontWeight: 700 }}>{r.intradayBias}</span>
      </div>

      <div style={{ marginBottom: 4 }}>
        Daily bias: <span style={{ color: r.dailyBias === "bullish" ? COLORS.green : r.dailyBias === "bearish" ? COLORS.red : COLORS.dim }}>{r.dailyBias}</span>
        {" · "}DXY: <span style={{ color: r.dxyAlignment === "aligned" ? COLORS.green : r.dxyAlignment === "conflicting" ? COLORS.red : COLORS.dim }}>{r.dxyAlignment}</span>
      </div>

      {r.highImpactNewsToday && (
        <div style={{ color: COLORS.amber, marginBottom: 4 }}>⚠ High-impact news today for this currency</div>
      )}

      {!isEntry && (
        <div style={{ color: COLORS.amber, marginBottom: 6 }}>Wait — {r.waitReason}</div>
      )}

      <div>Score: {r.score}</div>
      <div>Last: {r.lastClose?.toFixed(5)}</div>

      {r.supportResistance && (
        <div style={{ color: COLORS.dim }}>
          S/R: <span style={{ color: COLORS.green }}>{r.supportResistance.support?.toFixed(5)}</span> /{" "}
          <span style={{ color: COLORS.red }}>{r.supportResistance.resistance?.toFixed(5)}</span>
        </div>
      )}
      {r.orderBlock && (
        <div style={{ color: r.orderBlock.type === "bullish" ? COLORS.green : COLORS.red }}>
          OB ({r.orderBlock.type}) @ {r.orderBlock.price.toFixed(5)}
        </div>
      )}
      {r.fvg && (
        <div style={{ color: r.fvg.type === "bullish" ? COLORS.green : COLORS.red }}>
          FVG ({r.fvg.type}) @ {r.fvg.price.toFixed(5)}
        </div>
      )}
      {r.liquiditySweep && (
        <div style={{ color: COLORS.dim }}>Liquidity sweep ({r.liquiditySweep.type}) @ {r.liquiditySweep.sweptLevel.toFixed(5)}</div>
      )}

      <div style={{ color: COLORS.dim }}>
        Vol: <span style={{ color: COLORS.green }}>buy {r.buyVolume?.toFixed(2)}</span> /{" "}
        <span style={{ color: COLORS.red }}>sell {r.sellVolume?.toFixed(2)}</span>
        {r.volumeIsEstimated && <span> (estimated)</span>}
      </div>

      {isEntry && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, color: COLORS.blue }}>
          Entry {r.entry.toFixed(5)} · SL {r.sl.toFixed(5)} · TP {r.tp.toFixed(5)}
        </div>
      )}
    </div>
  );
}
