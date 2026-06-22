import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Badge } from "./ui";

const ROLE_THEME = {
  customer: { label: "Customer", tone: "danger", accent: "var(--tomato-500)" },
  retailer: { label: "Retailer Portal", tone: "success", accent: "var(--forest-500)" },
  admin: { label: "Stockist / Admin", tone: "warning", accent: "var(--amber-500)" },
};

export default function PortalLayout({ children, navItems = [], rightSlot = null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = ROLE_THEME[user?.role] || ROLE_THEME.customer;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream-100)" }}>
      <header
        style={{
          background: "var(--white)",
          borderBottom: "1px solid var(--line)",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌿</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>FreshLine</span>
            <Badge tone={theme.tone}>{theme.label}</Badge>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {navItems.map((item) => (
              <NavLink key={item.to} {...item} accent={theme.accent} />
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {rightSlot}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--charcoal-300)" }}>
                {user?.phone}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "var(--sage-100)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--forest-700)",
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main style={{ padding: "28px", maxWidth: 1280, margin: "0 auto" }}>{children}</main>
    </div>
  );
}

function NavLink({ to, label, active, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--sage-100)" : "transparent",
        border: "none",
        borderRadius: "var(--radius-sm)",
        padding: "8px 14px",
        fontSize: 13.5,
        fontWeight: 600,
        color: active ? "var(--forest-900)" : "var(--charcoal-600)",
        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}
