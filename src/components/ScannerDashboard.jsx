import React, { useState } from "react";
import { ALL_PAIRS } from "../lib/pairs";
import { fetchCryptoCandles, fetchBinanceCommodityCandles, fetchForexCandles } from "../lib/dataFeeds";
import { analyzePairFull } from "../lib/analyzePairFull";
import NewsPanel from "./NewsPanel";
import ScanningIndicator from "./ScanningIndicator";
import { getPlanConfig } from "../lib/plans";
import { checkAndConsumeScan, filterPairsForPlan } from "../lib/scanGate";

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
      fetchOneHour: (s) => fetchCryptoCandles(s, "1h", 100),
      fetchFifteen: (s) => fetchCryptoCandles(s, "15min", 150),
      fetchFive: (s) => fetchCryptoCandles(s, "5min", 150),
    };
  }
  if (pair.market === "commodity-binance") {
    return {
      fetchDaily: (s) => fetchBinanceCommodityCandles(s, "1day", 90),
      fetchOneHour: (s) => fetchBinanceCommodityCandles(s, "1h", 100),
      fetchFifteen: (s) => fetchBinanceCommodityCandles(s, "15min", 150),
      fetchFive: (s) => fetchBinanceCommodityCandles(s, "5min", 150),
    };
  }
  return {
    fetchDaily: (s) => fetchForexCandles(s, "1day", 90),
    fetchOneHour: (s) => fetchForexCandles(s, "1h", 100),
    fetchFifteen: (s) => fetchForexCandles(s, "15min", 150),
    fetchFive: (s) => fetchForexCandles(s, "5min", 150),
  };
}

export default function ScannerDashboard({ profile, userId, onSignOut }) {
  const plan = getPlanConfig(profile?.plan);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showNews, setShowNews] = useState(false);
  const [gateMessage, setGateMessage] = useState("");

  const runScan = async () => {
    setGateMessage("");
    const gate = await checkAndConsumeScan(userId, profile);
    if (!gate.allowed) {
      setGateMessage(gate.reason);
      return;
    }

    const pairsToScan = filterPairsForPlan(ALL_PAIRS, profile?.plan);

    setStatus("scanning");
    setResults([]);
    setProgress({ done: 0, total: pairsToScan.length });

    for (const pair of pairsToScan) {
      let result;
      try {
        result = await analyzePairFull({ symbol: pair.symbol, market: pair.market, fetchers: fetchersFor(pair) });
      } catch (err) {
        result = { symbol: pair.symbol, market: pair.market, error: err.message };
      }
      setResults((prev) => [...prev, result]);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      await new Promise((r) => setTimeout(r, 50));
    }

    setStatus("idle");
  };

  const entries = results.filter((r) => !r.error && r.action === "entry");
  const watching = results.filter((r) => !r.error && r.action === "wait");
  const errored = results.filter((r) => r.error);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <div style={{ textAlign: "center", padding: "32px 0 8px" }}>
          <img src="/IMG-20260912-WA9285.jpg" alt="GroWiz Scanner" style={{ width: 140, height: "auto", filter: "drop-shadow(0 0 18px rgba(34,197,94,0.35))" }} />
        </div>

        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, marginBottom: 6, color: COLORS.green }}>Live Scan</h1>
          <p style={{ fontSize: 13, color: COLORS.dim, maxWidth: 640, margin: "0 auto" }}>
            Analyze all markets in one go.
          </p>
        </header>

        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
          {plan.signalPanelAccess ? (
            <a
              href="https://growizanalytics.lovable.app"
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, color: COLORS.blue, fontWeight: 700, borderRadius: 6, padding: "8px 14px", textDecoration: "none" }}
            >
              Signal
            </a>
          ) : (
            <button disabled style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontWeight: 700, borderRadius: 6, padding: "8px 14px", cursor: "not-allowed" }} title="Premium/Founding only">
              Signal 🔒
            </button>
          )}

          {plan.newsAccess ? (
            <button
              onClick={() => setShowNews(true)}
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, color: COLORS.amber, fontWeight: 700, borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              News
            </button>
          ) : (
            <button disabled style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, color: COLORS.dim, fontWeight: 700, borderRadius: 6, padding: "8px 14px", cursor: "not-allowed" }} title="Premium/Founding only">
              News 🔒
            </button>
          )}

          <button onClick={runScan} disabled={status !== "idle"} style={{ background: COLORS.green, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>
            {status !== "idle" ? `Scanning ${progress.done}/${progress.total}...` : "Run scan"}
          </button>
        </section>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: COLORS.dim }}>
            Plan: <span style={{ color: COLORS.green }}>{plan.label}</span>
            {plan.scansPerDay !== Infinity && ` · ${plan.scansPerDay} scans/day`}
          </span>
          <div style={{ marginTop: 8 }}>
            <a
              href="/upgrade"
              style={{ display: "inline-block", background: COLORS.green, color: "#000", fontWeight: 700, borderRadius: 6, padding: "6px 16px", textDecoration: "none", fontSize: 12 }}
            >
              Upgrade Plan
            </a>
          </div>
          {gateMessage && <div style={{ color: COLORS.red, fontSize: 12, marginTop: 8 }}>{gateMessage}</div>}
        </div>

        {showNews && <NewsPanel onClose={() => setShowNews(false)} />}
        {status !== "idle" && <ScanningIndicator />}

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Entries found</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
          {entries.length === 0 && <p style={{ fontSize: 13, color: COLORS.dim }}>No pairs currently have a qualifying entry.</p>}
          {entries.map((r) => <PairCard key={r.symbol} r={r} highlighted />)}
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.green }}>Watching (no entry yet)</h2>
        <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
          {watching.map((r) => <PairCard key={r.symbol} r={r} />)}
        </div>

        {errored.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, marginBottom: 8, color: COLORS.red }}>Couldn't scan ({errored.length})</h2>
            <div style={{ display: "grid", gap: 6, marginBottom: 40, fontSize: 12, color: COLORS.dim }}>
              {errored.map((r) => (
                <div key={r.symbol} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8 }}>
                  <strong>{r.symbol}</strong>: {r.error}
                </div>
              ))}
            </div>
          </>
        )}

        <footer style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 20, paddingBottom: 32, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: COLORS.dim, maxWidth: 560, margin: "0 auto 12px", lineHeight: 1.5 }}>
            This is not an AI tool — GroWiz runs purely on current available market data, applying
            all previously tested strategies, confirming all alignments with order flow and volume
            differences from data sources to derive a relative analysis. For safety purposes below:
          </p>
          <p style={{ fontSize: 10, color: COLORS.amber, maxWidth: 520, margin: "0 auto 12px", fontWeight: 700 }}>
            DISCLAIMER: Always consider your risk. This is not financial advice.
          </p>
          <p style={{ fontSize: 10, color: COLORS.dim, maxWidth: 520, margin: "0 auto" }}>
            Contact us = <a href="mailto:ghostgrower88@gmail.com" style={{ color: COLORS.blue }}>ghostgrower88@gmail.com</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

function PairCard({ r, highlighted }) {
  const isEntry = r.action === "entry";
  const biasColor = r.dailyBias === "bullish" ? COLORS.green : r.dailyBias === "bearish" ? COLORS.red : COLORS.dim;
  const intradayColor = r.intradayBias === "bullish" ? COLORS.green : r.intradayBias === "bearish" ? COLORS.red : COLORS.dim;

  return (
    <div style={{ border: highlighted ? `2px solid ${COLORS.green}` : `1px solid ${COLORS.border}`, background: COLORS.panel, borderRadius: 8, padding: 12, fontSize: 13, color: COLORS.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>{r.symbol}</strong>
        {isEntry && <span style={{ color: COLORS.green, fontWeight: 700 }}>{r.setupName}</span>}
      </div>

      <div>Dailybias = <span style={{ color: biasColor }}>{r.dailyBias || "unknown"}</span></div>
      <div>Intraday = <span style={{ color: intradayColor }}>{r.intradayBias || "unknown"}</span></div>
      {r.keyLevels && (
        <div>Key S/R = <span style={{ color: COLORS.green }}>{r.keyLevels.support?.toFixed(5)}</span>, <span style={{ color: COLORS.red }}>{r.keyLevels.resistance?.toFixed(5)}</span></div>
      )}
      <div>Order blocks = {r.orderBlock ? <span style={{ color: r.orderBlock.type === "bullish" ? COLORS.green : COLORS.red }}>{r.orderBlock.price.toFixed(5)}</span> : "—"}</div>
      <div>FVG = {r.fvg ? <span style={{ color: r.fvg.type === "bullish" ? COLORS.green : COLORS.red }}>{r.fvg.price.toFixed(5)}</span> : "—"}</div>

      {r.killZone && <div style={{ color: COLORS.dim, marginTop: 4 }}>Session: {r.killZone.name}{r.killZone.active ? " (active)" : ""}</div>}
      {r.sessionLiquidity && (
        <div style={{ color: COLORS.dim }}>
          Liquidity — sell-side: {r.sessionLiquidity.sellSideLiquidity?.toFixed(5) ?? "—"} / buy-side: {r.sessionLiquidity.buySideLiquidity?.toFixed(5) ?? "—"}
        </div>
      )}

      {!isEntry && <div style={{ color: COLORS.amber, marginTop: 4 }}>Wait — {r.waitReason}</div>}

      {isEntry && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, color: COLORS.blue }}>
          Entry = {r.entry.toFixed(5)} · SL {r.sl.toFixed(5)} · TP {r.tp.toFixed(5)} · RR 1:{r.riskRewardRatio}
        </div>
      )}
    </div>
  );
}
