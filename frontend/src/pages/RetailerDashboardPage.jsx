import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, PageLoader } from "../components/ui";

export default function RetailerDashboardPage() {
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.retailerDashboard().then(setStats);
    api.retailerTopProducts().then(setTopProducts);
  }, []);

  return (
    <PortalLayout
      navItems={[
        { to: "/retailer", label: "Dashboard", active: true },
        { to: "/retailer/orders", label: "Orders", onClick: () => navigate("/retailer/orders") },
        { to: "/retailer/catalog", label: "Inventory & Pricing", onClick: () => navigate("/retailer/catalog") },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Today at a glance</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 22 }}>
        Order queue, fulfillment status, and sales summary for your store.
      </p>

      {!stats ? (
        <PageLoader />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 28 }}>
            <StatCard label="Today's orders" value={stats.today_orders} icon="📅" />
            <StatCard label="Pending" value={stats.pending_orders} icon="⏳" accent="var(--amber-500)" />
            <StatCard label="Completed" value={stats.completed_orders} icon="✅" accent="var(--forest-500)" />
            <StatCard label="Rejected / cancelled" value={stats.rejected_orders} icon="🚫" accent="var(--danger)" />
            <StatCard label="Total sales" value={`₹${stats.total_sales.toFixed(0)}`} icon="💰" accent="var(--tomato-500)" />
          </div>

          <Card style={{ padding: 22 }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Top-selling products</h3>
            {topProducts.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--charcoal-600)" }}>No sales recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topProducts.map((p, idx) => (
                  <div key={p.product_name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--charcoal-300)", width: 18 }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span style={{ flex: 1, fontSize: 14 }}>{p.product_name}</span>
                    <span style={{ fontSize: 13, color: "var(--charcoal-600)" }}>{p.total_qty} units</span>
                    <span style={{ fontSize: 14, fontWeight: 700, width: 80, textAlign: "right" }}>₹{p.total_sales.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </PortalLayout>
  );
}

function StatCard({ label, value, icon, accent = "var(--forest-500)" }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--charcoal-600)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontFamily: "var(--font-display)", color: accent }}>{value}</div>
    </Card>
  );
}
