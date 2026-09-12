import React, { useEffect, useState, useCallback } from "react";
import { ALL_PAIRS } from "../lib/pairs";
import { fetchCryptoCandles, fetchForexCandles, fetchBatch } from "../lib/dataFeeds";
import { analyzePair, rankTopPairs, getActiveKillZone } from "../lib/smcEngine";

const TIMEFRAMES = ["5min", "15min", "1h"];

export default function ScannerDashboard() {
  const [timeframe, setTimeframe] = useState("5min");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [lastRun, setLastRun] = useState(null);
  const [killZone, setKillZone] = useState(getActiveKillZone());

  useEffect(() => {
    const t = setInterval(() => setKillZone(getActiveKillZone()), 60_000);
    return () => clearInterval(t);
  }, []);

  const runScan = useCallback(async () => {
    setStatus("scanning");

    const cryptoPairs = ALL_PAIRS.filter((p) => p.market === "crypto");
    const nonCrypto = ALL_PAIRS.filter((p) => p.market !== "crypto");

    const cryptoResults = await Promise.all(
      cryptoPairs.map(async (p) => {
        try {
          const candles = await fetchCryptoCandles(p.symbol, timeframe);
          return analyzePair({ symbol: p.symbol, market: p.market, candles, timeframe });
        } catch (err) {
          return { symbol: p.symbol, market: p.market, error: err.message };
        }
      })
    );

    setStatus("scanning forex/commodities");
    const fxRaw = await fetchBatch(
      nonCrypto.map((p) => p.symbol),
      (symbol) => fetchForexCandles(symbol, timeframe)
    );
    const fxResults = nonCrypto.map((p) => {
      const candles = fxRaw[p.symbol];
      if (!candles || candles.error) {
        return { symbol: p.symbol, market: p.market, error: candles?.error || "fetch failed" };
      }
      return analyzePair({ symbol: p.symbol, market: p.market, candles, timeframe });
    });

    setResults([...cryptoResults, ...fxResults]);
    setLastRun(new Date());
    setStatus("idle");
  }, [timeframe]);

  const topThree = rankTopPairs(results, 3);
  const watchlist = results
    .filter((r) => !r.error)
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>GroWiz Scanner</h1>
        <p style={{ fontSize: 13, color: "#666" }}>
          Live SMC/ICT structure scan across {ALL_PAIRS.length} pairs. Run alongside TradingView —
          this is a read-only overlay, not a broker or execution tool.
        </p>
      </header>

      <section style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>
          Timeframe:{" "}
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>

        <button onClick={runScan} disabled={status.startsWith("scanning")}>
          {status.startsWith("scanning") ? "Scanning..." : "Run scan"}
        </button>
      </section>

      <div
        style={{
          padding: "8px 12px",
          background: killZone.active ? "#e6f4ea" : "#f3f3f3",
          borderRadius: 6,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        Session: <strong>{killZone.name}</strong> {killZone.active ? "(active kill zone)" : ""}
        {lastRun && <span style={{ color: "#888" }}> · last scan {lastRun.toLocaleTimeString()}</span>}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Top 3 to trade</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
        {topThree.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Run a scan to populate this.</p>}
        {topThree.map((r) => (
          <PairCard key={r.symbol} r={r} highlighted />
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Full watchlist</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {watchlist.map((r) => (
          <PairCard key={r.symbol} r={r} />
        ))}
      </div>
    </div>
  );
}

function PairCard({ r, highlighted }) {
  const dirColor = r.bias === "bullish" ? "#1a7f37" : r.bias === "bearish" ? "#c92a2a" : "#888";
  return (
    <div
      style={{
        border: highlighted ? "2px solid #1a7f37" : "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>{r.symbol}</strong>
        <span style={{ color: dirColor, textTransform: "capitalize" }}>{r.bias}</span>
      </div>
      <div>Score: {r.score}</div>
      <div>Last: {r.lastClose?.toFixed(5)}</div>
      {r.orderBlock && (
        <div>
          OB ({r.orderBlock.type}) @ {r.orderBlock.price.toFixed(5)}
        </div>
      )}
      {r.fvg && (
        <div>
          FVG ({r.fvg.type}) @ {r.fvg.price.toFixed(5)}
        </div>
      )}
      {r.brm && <div>BRM (buy-side pool) @ {r.brm.price.toFixed(5)}</div>}
      {r.srm && <div>SRM (sell-side pool) @ {r.srm.price.toFixed(5)}</div>}
      <div>
        Vol: buy {r.buyVolume?.toFixed(2)} / sell {r.sellVolume?.toFixed(2)}
        {r.volumeIsEstimated && <span style={{ color: "#888" }}> (estimated — no real forex volume feed)</span>}
      </div>
      {r.entry != null && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #eee" }}>
          Entry {r.entry.toFixed(5)} · SL {r.sl.toFixed(5)} · TP {r.tp.toFixed(5)}
        </div>
      )}
    </div>
  );
}
