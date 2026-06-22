import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, ErrorBanner } from "../components/ui";

const DEMO_ACCOUNTS = [
  { role: "Customer", phone: "9000000001", password: "customer123", color: "var(--tomato-500)" },
  { role: "Retailer", phone: "9820011111", password: "retailer123", color: "var(--forest-500)" },
  { role: "Admin / Stockist", phone: "9999999999", password: "admin123", color: "var(--amber-500)" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(phone, password);
      routeForRole(user.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function routeForRole(role) {
    if (role === "customer") navigate("/shop");
    else if (role === "retailer") navigate("/retailer");
    else if (role === "admin") navigate("/admin");
  }

  function fillDemo(acc) {
    setPhone(acc.phone);
    setPassword(acc.password);
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        background: "var(--cream-100)",
      }}
    >
      <div
        style={{
          background: "var(--forest-900)",
          color: "var(--cream-50)",
          padding: "64px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
            <span style={{ fontSize: 26 }}>🌿</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--cream-50)" }}>
              FreshLine
            </span>
          </div>
          <h1 style={{ color: "var(--cream-50)", fontSize: 44, lineHeight: 1.15, maxWidth: 480, marginBottom: 20 }}>
            One order rail, three roles, zero spreadsheets.
          </h1>
          <p style={{ fontSize: 16, color: "var(--sage-200)", maxWidth: 420, lineHeight: 1.6 }}>
            A working MVP of the multi-retailer grocery commerce platform — customer
            ordering, retailer fulfillment, and stockist oversight, connected end to
            end on one order lifecycle.
          </p>
        </div>

        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Stat label="Retailers onboarded" value="3" />
          <Stat label="Master SKUs" value="20" />
          <Stat label="Order stages tracked" value="5" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, marginBottom: 6 }}>Sign in</h2>
          <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 28 }}>
            Use your phone number and password.
          </p>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Phone number</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. 9000000001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p style={{ fontSize: 13.5, color: "var(--charcoal-600)", marginTop: 16, textAlign: "center" }}>
            New customer?{" "}
            <Link to="/register" style={{ color: "var(--tomato-600)", fontWeight: 600 }}>
              Create an account
            </Link>
          </p>

          <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <p style={{ fontSize: 12.5, color: "var(--charcoal-300)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Demo accounts — for client walkthrough
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  onClick={() => fillDemo(acc)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--white)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    padding: "9px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: acc.color }} />
                    {acc.role}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--charcoal-600)" }}>
                    {acc.phone}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-display)", color: "var(--cream-50)" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--sage-200)" }}>{label}</div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--charcoal-600)",
  marginBottom: 6,
  marginTop: 14,
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1.5px solid var(--line)",
  fontSize: 14.5,
  background: "var(--white)",
};
