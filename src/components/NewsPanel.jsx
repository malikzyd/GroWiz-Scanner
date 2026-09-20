import React, { useEffect, useState } from "react";
import { getTodaysNews } from "../lib/newsAnalysis";

const COLORS = {
  panel: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.65)",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#3b82f6",
  orange: "#f97316",
};

export default function NewsPanel({ onClose }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTodaysNews()
      .then(setNews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const dirColor = (d) => (d === "bullish" ? COLORS.green : d === "bearish" ? COLORS.red : d === "neutral" ? COLORS.amber : COLORS.dim);
  
  const sourceStyle = (source) => {
    const isFinnhub = source === "Finnhub";
    return {
      background: isFinnhub ? "rgba(59,130,246,0.15)" : "rgba(249,115,22,0.15)",
      color: isFinnhub ? COLORS.blue : COLORS.orange,
      border: `1px solid ${isFinnhub ? "rgba(59,130,246,0.3)" : "rgba(249,115,22,0.3)"}`,
      fontSize: 10,
      padding: "2px 6px",
      borderRadius: 4,
      fontWeight: 700,
      letterSpacing: "0.5px",
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, width: "100%", maxWidth: 560, marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ color: COLORS.green, fontSize: 16, margin: 0 }}>Today's Market Feed</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <p style={{ fontSize: 11, color: COLORS.dim, marginBottom: 12 }}>
          Merged: Forex Factory (high-impact) + Finnhub (market headlines). Bullish/bearish is actual vs estimate heuristic.
        </p>

        {loading && <p style={{ color: COLORS.dim, fontSize: 13 }}>Loading unified feed...</p>}
        {error && <p style={{ color: COLORS.red, fontSize: 13 }}>{error}</p>}
        {!loading && !error && news.length === 0 && <p style={{ color: COLORS.dim, fontSize: 13 }}>No events today.</p>}

        <div style={{ display: "grid", gap: 8 }}>
          {news.map((n, i) => (
            <div key={n.id || i} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <strong style={{ color: COLORS.text, flex: 1 }}>
                  {n.type === "market-news" ? "" : `${n.currency} — `}{n.event}
                </strong>
                <span style={sourceStyle(n.source || "Forex Factory")}>{n.source || "Forex Factory"}</span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: COLORS.dim, fontSize: 11 }}>{n.time ? new Date(n.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "—"}</span>
                <span style={{ color: dirColor(n.direction), textTransform: "capitalize", fontWeight: 700, fontSize: 11, background: `${dirColor(n.direction)}15`, padding: "1px 6px", borderRadius: 4 }}>
                  {n.direction}
                </span>
                {n.impact && <span style={{ color: COLORS.amber, fontSize: 10 }}>● HIGH</span>}
              </div>

              {n.actual != null && (
                <div style={{ color: COLORS.dim, fontSize: 11 }}>Actual {n.actual} vs Est {n.estimate} (Prev {n.previous})</div>
              )}
              
              {n.summary && (
                <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{n.summary.slice(0, 120)}...</div>
              )}

              {n.url && (
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color: COLORS.blue, fontSize: 11, marginTop: 4, display: "inline-block" }}>Read full →</a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
