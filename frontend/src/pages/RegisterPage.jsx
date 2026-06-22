import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, ErrorBanner } from "../components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, phone, password);
      navigate("/shop");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream-100)" }}>
      <div style={{ width: "100%", maxWidth: 380, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, justifyContent: "center" }}>
          <span style={{ fontSize: 24 }}>🌿</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600 }}>FreshLine</span>
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 6, textAlign: "center" }}>Create your account</h2>
        <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
          Order groceries from retailers near you.
        </p>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Full name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
          <label style={labelStyle}>Phone number</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="primary" size="lg" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p style={{ fontSize: 13.5, color: "var(--charcoal-600)", marginTop: 16, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--tomato-600)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
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
