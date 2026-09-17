import React, { useState } from "react";
import { ALL_PAIRS } from "../lib/pairs";
import { fetchCryptoCandles, fetchBinanceCommodityCandles, fetchForexCandles } from "../lib/dataFeeds";
import { analyzePairFull } from "../lib/analyzePairFull";

const ENTRY_TIMEFRAMES = ["5min", "15min"]; // per your spec — the only two choices

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

function fetchersFor(pair) {
  if (pair.market === "crypto") {
    return {
      fetchDaily: (s) => fetchCryptoCandles(s, "1day", 90),
      fetchFourHour: (s) => fetchCryptoCandles(s, "4h", 60),
      fetchOneHour: (s) => fetchCryptoCandles(s, "1h", 100),
      fetchEntry: (s, tf) => fetchCryptoCandles(s, tf, 150),
    };
  }
  if (pair.market === "commodity-binance") {
    return {
      fetchDaily: (s) => fetchBinanceCommodityCandles(s, "1day", 90),
      fetchFourHour: (s) => fetchBinanceCommodityCandles(s, "4h", 60),
      fetchOneHour: (s) => fetchBinanceCommodityCandles(s, "1h", 100),
      fetchEntry: (s, tf) => fetchBinanceCommodityCandles(s, tf, 150),
    };
  }
  // forex + oil + copper -> Twelve Data proxy
  return {
    fetchDaily: (s) => fetchForexCandles(s, "1day", 90),
    fetchFourHour: (s) => fetchForexCandles(s, "4h", 60),
    fetchOneHour: (s) => fetchForexCandles(s, "1h", 100),
    fetchEntry: (s, tf) => fetchForexCandles(s, tf, 150),
  };
}

export default function ScannerDashboard() {
  const [entryTimeframe, setEntryTimeframe] = useState("15min");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const runScan = async () => {
    setStatus("scanning");
    setProgress({ done: 0, total: ALL_PAIRS.length });
    const out = [];

    // Sequential with a light delay: this funnel already cuts calls a lot
    // (most pairs stop at daily/4H), but staying paced avoids hammering
    // the proxy/rate limits on a full 51-pair sweep.
    for (const pair of ALL_PAIRS) {
      const base = fetchersFor(pair);
      const fetchEntry = (s) => base.fetchEntry(s, entryTimeframe);
      try {
        const result = await analyzePairFull({
          symbol: pair.symbol,
          market: pair.market,
          entryTimeframe,
          fetchers: { ...base, fetchEntry },
        });
        out.push(result);
      } catch (err) {
        out.push({ symbol: pair.symbol, market: pair.market, error: err.message });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      await new Promise((r) => setTimeout(r, 150));
    }

    setResults(out);
    setStatus("idle");
  };

  const entries = results.filter((r) => !r.error && r.action === "entry").sort((a, b) => 0);
  const watching = results.filter((r) => !r.error && r.action === "wait");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <div style={{ textAlign: "center", padding: "32px 0 8px" }}>
          <img src="/IMG-20260912-WA9285.jpg" alt="GroWiz Scanner" style={{ width: 140, height: "auto", filter: "drop-shadow(0 0 18px rgba(34,197,94,0.35))" }} />
        </div>

        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, marginBottom: 6, color: COLORS.green }}>Live Scan</h1>
          <p style={{ fontSize: 13, color: COLORS.dim, maxWidth: 640, margin: "0 auto" }}>
            Daily bias -&gt; 4H direction -&gt; 1H levels -&gt; entry setup, top-down, {ALL_PAIRS.length} pairs.
          </p>
        </header>

        <section style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>
            Entry timeframe:{" "}
            <select value={entryTimeframe} onChange={(e) => setEntryTimeframe(e.target.value)} style={{ background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
              {ENTRY_TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </label>
          <button onClick={runScan} disabled={status !== "idle"} style={{ background: COLORS.green, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>
            {status !== "idle" ? `Scanning ${progress.done}/${progress.total}...` : "Run scan"}
          </button>
        </section>

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Entries found</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
          {entries.length === 0 && <p style={{ fontSize: 13, color: COLORS.dim }}>No pairs currently have a qualifying entry. See below for pairs to watch.</p>}
          {entries.map((r) => <PairCard key={r.symbol} r={r} highlighted />)}
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Watching (no entry yet)</h2>
        <div style={{ display: "grid", gap: 8, marginBottom: 40 }}>
          {watching.map((r) => <PairCard key={r.symbol} r={r} />)}
        </div>
      </div>
    </div>
  );
}

function PairCard({ r, highlighted }) {
  const isEntry = r.action === "entry";
  const biasColor = r.dailyBias === "bullish" ? COLORS.green : r.dailyBias === "bearish" ? COLORS.red : COLORS.dim;

  return (
    <div style={{ border: highlighted ? `2px solid ${COLORS.green}` : `1px solid ${COLORS.border}`, background: COLORS.panel, borderRadius: 8, padding: 12, fontSize: 13, color: COLORS.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>{r.symbol}</strong>
        {isEntry && <span style={{ color: COLORS.green, fontWeight: 700 }}>{r.setupName}</span>}
      </div>

      <div style={{ marginBottom: 4, color: biasColor }}>
        {r.displayBias || `Daily bias: ${r.dailyBias || "unknown"}`}
      </div>

      {!isEntry && <div style={{ color: COLORS.amber, marginBottom: 6 }}>Wait — {r.waitReason}</div>}
      {isEntry && <div style={{ color: COLORS.dim, marginBottom: 6 }}>{r.setupReason}</div>}

      {r.entryTimeframe && <div style={{ color: COLORS.dim }}>Entry TF: {r.entryTimeframe}</div>}
      {r.marketMakerPhase && <div style={{ color: COLORS.dim }}>MM phase (1H): {r.marketMakerPhase}</div>}
      {r.premiumDiscount && <div style={{ color: COLORS.dim }}>4H zone: {r.premiumDiscount}</div>}

      {r.supportResistance && (
        <div style={{ color: COLORS.dim }}>
          S/R: <span style={{ color: COLORS.green }}>{r.supportResistance.support?.toFixed(5)}</span> /{" "}
          <span style={{ color: COLORS.red }}>{r.supportResistance.resistance?.toFixed(5)}</span>
        </div>
      )}
      {r.orderBlock && (
        <div style={{ color: r.orderBlock.type === "bullish" ? COLORS.green : COLORS.red }}>
          OB (1H, {r.orderBlock.type}) @ {r.orderBlock.price.toFixed(5)}
        </div>
      )}
      {r.fvg && (
        <div style={{ color: r.fvg.type === "bullish" ? COLORS.green : COLORS.red }}>
          FVG (1H, {r.fvg.type}) @ {r.fvg.price.toFixed(5)}
        </div>
      )}

      {isEntry && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, color: COLORS.blue }}>
          Entry {r.entry.toFixed(5)} · SL {r.sl.toFixed(5)} · TP {r.tp.toFixed(5)} · RR 1:{r.riskRewardRatio}
        </div>
      )}
    </div>
  );
}
