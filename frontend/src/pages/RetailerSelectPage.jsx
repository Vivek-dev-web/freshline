import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, PageLoader } from "../components/ui";

export default function RetailerSelectPage() {
  const [retailers, setRetailers] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.listRetailers().then(setRetailers).catch((e) => setError(e.message));
  }, []);

  return (
    <PortalLayout
      navItems={[
        { to: "/shop", label: "Browse Retailers", active: true },
        { to: "/shop/orders", label: "My Orders", onClick: () => navigate("/shop/orders") },
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>Choose a retailer</h1>
        <p style={{ color: "var(--charcoal-600)", fontSize: 14.5, marginTop: 4 }}>
          Each retailer sets their own prices and availability for the same master catalog.
        </p>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!retailers && !error && <PageLoader label="Loading retailers…" />}

      {retailers && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {retailers.map((r) => (
            <Card
              key={r.id}
              style={{ padding: 22, cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
              onClick={() => navigate(`/shop/retailer/${r.id}`, { state: { storeName: r.store_name } })}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--sage-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  marginBottom: 14,
                }}
              >
                🏪
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 4 }}>{r.store_name}</h3>
              <p style={{ fontSize: 13.5, color: "var(--charcoal-600)", marginBottom: 2 }}>{r.area}</p>
              <p style={{ fontSize: 12.5, color: "var(--charcoal-300)" }}>Owner: {r.owner_name}</p>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
