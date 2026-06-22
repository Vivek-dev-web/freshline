import React from "react";

export function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "var(--sage-100)", color: "var(--forest-700)" },
    success: { bg: "#e6f0e9", color: "var(--success)" },
    warning: { bg: "var(--amber-100)", color: "#94650f" },
    danger: { bg: "var(--tomato-100)", color: "var(--danger)" },
    dark: { bg: "var(--forest-900)", color: "var(--cream-50)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: t.bg,
        color: t.color,
        textTransform: "capitalize",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", size = "md", style, ...props }) {
  const base = {
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontWeight: 600,
    transition: "transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 13 },
    md: { padding: "10px 18px", fontSize: 14 },
    lg: { padding: "13px 24px", fontSize: 15 },
  };
  const variants = {
    primary: { background: "var(--tomato-500)", color: "#fff" },
    secondary: { background: "var(--forest-700)", color: "#fff" },
    outline: { background: "transparent", color: "var(--forest-700)", border: "1.5px solid var(--line)" },
    ghost: { background: "transparent", color: "var(--charcoal-600)" },
    danger: { background: "var(--tomato-100)", color: "var(--danger)" },
    success: { background: "var(--sage-200)", color: "var(--forest-900)" },
  };
  return (
    <button
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, style, ...props }) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon = "🛒", title, subtitle, action }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--charcoal-600)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 14, maxWidth: 360, margin: "0 auto 16px" }}>{subtitle}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 22 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: "3px solid var(--sage-200)",
        borderTopColor: "var(--forest-500)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

export function PageLoader({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 0" }}>
      <Spinner size={28} />
      <span style={{ fontSize: 13, color: "var(--charcoal-600)" }}>{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "var(--tomato-100)",
        color: "var(--danger)",
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        fontSize: 13.5,
        fontWeight: 500,
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  );
}
