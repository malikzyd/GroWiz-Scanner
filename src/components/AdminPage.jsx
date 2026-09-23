import React, { useState } from "react";

const COLORS = {
  bg: "#000000",
  panel: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.65)",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
};

const PLAN_CHOICES = [
  { key: "pro", label: "Pro — 30 days" },
  { key: "premium", label: "Premium — 30 days" },
  { key: "founding", label: "Founding Member — lifetime" },
];

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pending, setPending] = useState([]);
  const [proUsers, setProUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState({}); // { [verificationId]: planKey }

  const load = async (pw) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed to load");
      setPending(json.pending || []);
      setProUsers(json.proUsers || []);
      setSelectedPlans((prev) => {
        const next = { ...prev };
        (json.pending || []).forEach((p) => {
          if (!next[p.id]) next[p.id] = p.plan;
        });
        return next;
      });
      setUnlocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const act = async (verificationId, action) => {
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, verificationId, action, overridePlan: selectedPlans[verificationId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "action failed");
      load(password); // refresh both lists
    } catch (err) {
      setError(err.message);
    }
  };

  if (!unlocked) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(password);
          }}
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 24, width: 320 }}
        >
          <h1 style={{ color: COLORS.green, fontSize: 18, marginBottom: 12, textAlign: "center" }}>Admin Access</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{ width: "100%", background: "#000", color: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}
          />
          {error && <p style={{ color: COLORS.red, fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", background: COLORS.green, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "10px 0", cursor: "pointer" }}>
            {loading ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ color: COLORS.green, fontSize: 20, marginBottom: 16 }}>Admin — Payment Verifications</h1>

        <h2 style={{ fontSize: 15, color: COLORS.amber, marginBottom: 8 }}>Pending ({pending.length})</h2>
        {pending.length === 0 && <p style={{ color: COLORS.dim, fontSize: 13, marginBottom: 20 }}>Nothing pending.</p>}
        <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
          {pending.map((p) => (
            <div key={p.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, fontSize: 13 }}>
              <div><strong>{p.email}</strong> — submitted: {p.plan}</div>
              <div style={{ color: COLORS.dim }}>TRX: {p.trx_number}</div>
              <div style={{ color: COLORS.dim }}>{new Date(p.created_at).toLocaleString()}</div>
              {p.screenshot_url && (
                <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.green }}>
                  View screenshot
                </a>
              )}
              <label style={{ display: "block", fontSize: 12, color: COLORS.dim, marginTop: 8 }}>
                Grant plan:
                <select
                  value={selectedPlans[p.id] || p.plan}
                  onChange={(e) => setSelectedPlans((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4, background: "#000", color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px" }}
                >
                  {PLAN_CHOICES.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => act(p.id, "verify")} style={{ background: COLORS.green, color: "#000", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
                  Verify
                </button>
                <button onClick={() => act(p.id, "reject")} style={{ background: COLORS.red, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 15, color: COLORS.green, marginBottom: 8 }}>Pro Users ({proUsers.length})</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {proUsers.map((u) => (
            <div key={u.email} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, fontSize: 13 }}>
              <div><strong>{u.email}</strong> — {u.plan} ({u.plan_status})</div>
              <div style={{ color: COLORS.dim }}>Expires: {u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
