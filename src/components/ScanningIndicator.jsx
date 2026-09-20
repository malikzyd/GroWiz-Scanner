import React, { useEffect, useState } from "react";

const PHRASES = [
  "Reading orderflow...",
  "Order block marked...",
  "Reading volume...",
  "Scanning previous levels...",
  "Liquidity sweep detected...",
  "Reading retail orders...",
  "Sellside retail entries scanned...",
  "Buyside retail orders being scanned...",
  "Liquidity marked...",
  "Marking fair value gaps...",
  "Confirming daily bias...",
  "Aligning market structure...",
];

const COLORS = {
  green: "#22c55e",
  dim: "rgba(255,255,255,0.65)",
  border: "#1a1a1a",
  panel: "#0a0a0a"
};

export default function ScanningIndicator() {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), 1100);
    const p = setInterval(() => setProgress(v => v < 94? v + Math.floor(Math.random()*7) : v), 600);
    return () => { clearInterval(t); clearInterval(p); };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%", padding: 16 }}>
      <div style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        width: "100%",
        maxWidth: 380,
        padding: 16,
        boxShadow: "0 0 40px rgba(34,197,94,0.15)",
        position: "relative",
        overflow: "hidden"
      }}>

        {/* Header Chart Mini */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: COLORS.green, fontWeight: 700, letterSpacing: 1 }}>LIVE MARKET SCAN</span>
          <span style={{ fontSize: 10, color: COLORS.dim }}>• {progress}%</span>
        </div>

        {/* MAIN VISUAL - Globe + Bull */}
        <div style={{
          position: "relative",
          height: 200,
          background: "#000",
          borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}>
          {/* Use your generated image OR pure CSS globe */}
          <img
            src="/bull-globe.jpg"
            alt="Scanning"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              animation: "growiz-spin-slow 8s linear infinite"
            }}
          />

          {/* Fallback CSS globe if image not loaded */}
          <div style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: `1px dashed ${COLORS.green}`,
            opacity: 0.15,
            animation: "growiz-spin 2s linear infinite"
          }} />
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: 14, height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: COLORS.green, transition: "width 0.6s ease", boxShadow: `0 0 10px ${COLORS.green}` }} />
        </div>

        {/* Scanning Text */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, minHeight: 18, textAlign: "center" }}>
            {PHRASES[index]}
          </div>
          <div style={{ fontSize: 10, color: COLORS.dim, display: "flex", gap: 8 }}>
            <span>⚡ {Math.floor(Math.random()*40)+10}ms</span>
            <span>• VOL: +{(Math.random()*3).toFixed(1)}%</span>
          </div>
        </div>

        <style>{`
          @keyframes growiz-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes growiz-spin-slow { from { transform: scale(1.05) rotate(0deg); } to { transform: scale(1.05) rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
