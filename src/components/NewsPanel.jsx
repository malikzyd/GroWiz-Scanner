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

  const dirColor = (d) => (d === "bullish" ? COLORS.green : d === "bearish" ? COLORS.red : COLORS.dim);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, width: "100%", maxWidth: 560, marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ color: COLORS.green, fontSize: 16, margin: 0 }}>Today's High-Impact News</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.text, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <p style={{ fontSize: 11, color: COLORS.dim, marginBottom: 12 }}>
          Bullish/bearish tags are a simplified actual-vs-estimate read, not a guarantee of price reaction.
        </p>

        {loading && <p style={{ color: COLORS.dim, fontSize: 13 }}>Loading...</p>}
        {error && <p style={{ color: COLORS.red, fontSize: 13 }}>{error}</p>}
        {!loading && !error && news.length === 0 && <p style={{ color: COLORS.dim, fontSize: 13 }}>No high-impact events today.</p>}

        <div style={{ display: "grid", gap: 8 }}>
          {news.map((n, i) => (
            <div key={i} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{n.currency} — {n.event}</strong>
                <span style={{ color: COLORS.dim }}>{n.time || "—"}</span>
              </div>
              <div style={{ color: dirColor(n.direction), textTransform: "capitalize", fontWeight: 700 }}>{n.direction}</div>
              {n.actual != null && (
                <div style={{ color: COLORS.dim }}>Actual {n.actual} vs Est {n.estimate} (Prev {n.previous})</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
