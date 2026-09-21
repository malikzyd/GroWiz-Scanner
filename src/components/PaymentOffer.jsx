import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const COLORS = {
  bg: "#000000",
  panel: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.65)",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
};

const BINANCE_PAY_ID = "839062484";

const PLAN_OPTIONS = [
  { key: "pro", title: "Pro — $29/month", desc: "Unlimited scans, all forex/commodities/crypto pairs" },
  { key: "premium", title: "Premium — $59/month", desc: "Everything in Pro + News panel + Signal panel (10 signals/day)" },
  { key: "founding", title: "Founding Member — $59 once, lifetime", desc: "First 15 members only — Premium access, pay once, never again" },
];

export default function PaymentOffer() {
  const [plan, setPlan] = useState("pro");
  const [email, setEmail] = useState("");
  const [trx, setTrx] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let screenshotUrl = null;
      if (file) {
        const path = `${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("payment-screenshots").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }

      const { error: insertErr } = await supabase.from("payment_verifications").insert({
        email, trx_number: trx, plan, screenshot_url: screenshotUrl,
      });
      if (insertErr) throw insertErr;
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
        <h1 style={{ color: COLORS.green, fontSize: 22, textAlign: "center", marginTop: 24 }}>Upgrade to Pro</h1>
        <p style={{ color: COLORS.dim, textAlign: "center", fontSize: 13, marginBottom: 24 }}>
          Free plan: 3 scans/day, 10 forex pairs + gold + BTC. Upgrade for full access.
        </p>

        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {PLAN_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPlan(opt.key)}
              style={{
                textAlign: "left",
                background: COLORS.panel,
                border: plan === opt.key ? `2px solid ${COLORS.green}` : `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: 14, color: COLORS.text, cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, color: COLORS.green }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: COLORS.dim }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, marginBottom: 24, fontSize: 13 }}>
          <p style={{ color: COLORS.green, fontWeight: 700, marginBottom: 8 }}>Pay via Binance Pay</p>
          <p style={{ color: COLORS.dim, marginBottom: 8 }}>Send the exact plan amount in USDT to Binance Pay ID:</p>
          <p style={{ wordBreak: "break-all", color: COLORS.blue, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{BINANCE_PAY_ID}</p>
          <p style={{ color: COLORS.dim }}>After sending, fill out the form below with your transaction (TRX) number so we can verify and activate your plan.</p>
        </div>

        {done ? (
          <p style={{ color: COLORS.green, textAlign: "center", fontSize: 14 }}>
            Submitted. We'll verify your payment and activate your plan shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ fontSize: 13, color: COLORS.dim }}>
              Signup email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ display: "block", width: "100%", marginTop: 6, background: "#000", color: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 14 }} />
            </label>
            <label style={{ fontSize: 13, color: COLORS.dim }}>
              TRX number
              <input type="text" value={trx} onChange={(e) => setTrx(e.target.value)} required
                style={{ display: "block", width: "100%", marginTop: 6, background: "#000", color: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 14 }} />
            </label>
            <label style={{ fontSize: 13, color: COLORS.dim }}>
              Upload screenshot (optional)
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={{ display: "block", marginTop: 6, color: COLORS.text }} />
            </label>
            {error && <p style={{ color: COLORS.red, fontSize: 12 }}>{error}</p>}
            <button type="submit" disabled={submitting}
              style={{ background: COLORS.green, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "10px 0", cursor: "pointer" }}>
              {submitting ? "Submitting..." : "Verify payment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
