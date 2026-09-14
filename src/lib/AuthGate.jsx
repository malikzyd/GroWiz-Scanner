import React, { useState } from "react";
import { signIn, signUp } from "../lib/auth";

const COLORS = {
  bg: "#000000",
  panel: "#0a0a0a",
  border: "#1a1a1a",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.65)",
  green: "#22c55e",
  red: "#ef4444",
};

export default function AuthGate() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setSignupDone(true);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 24,
        }}
      >
        <h1 style={{ color: COLORS.green, fontSize: 20, textAlign: "center", marginBottom: 4 }}>
          GroWiz Scanner
        </h1>
        <p style={{ color: COLORS.dim, fontSize: 13, textAlign: "center", marginBottom: 20 }}>
          {mode === "login" ? "Log in to run a scan" : "Create your free account"}
        </p>

        {signupDone ? (
          <p style={{ fontSize: 13, textAlign: "center", color: COLORS.green }}>
            Check your email to confirm your account, then log in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
            {error && <p style={{ color: COLORS.red, fontSize: 12 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: COLORS.green,
                color: "#000",
                fontWeight: 700,
                border: "none",
                borderRadius: 6,
                padding: "10px 0",
                cursor: "pointer",
              }}
            >
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 12, color: COLORS.dim, textAlign: "center", marginTop: 16 }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setSignupDone(false);
            }}
            style={{ background: "none", border: "none", color: COLORS.green, cursor: "pointer", padding: 0 }}
          >
            {mode === "login" ? "Sign up free" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  background: "#000",
  color: "#fff",
  border: "1px solid #1a1a1a",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
};
