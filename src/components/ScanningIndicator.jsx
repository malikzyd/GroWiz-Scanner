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

const COLORS = { green: "#22c55e", dim: "rgba(255,255,255,0.65)" };

export default function ScanningIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: `conic-gradient(${COLORS.green}, transparent 70%)`,
          animation: "growiz-spin 1s linear infinite",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "#000" }} />
      </div>
      <div style={{ fontSize: 12, color: COLORS.dim, minHeight: 16 }}>{PHRASES[index]}</div>
      <style>{`@keyframes growiz-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
