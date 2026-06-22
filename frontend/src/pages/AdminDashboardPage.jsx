import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, PageLoader } from "../components/ui";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.adminDashboard().then(setStats);
    api.adminRetailerPerformance().then(setPerformance);
    api.adminOrderStatusBreakdown().then(setStatusBreakdown);
  }, []);

  const maxSales = Math.max(1, ...performance.map((p) => p.total_sales));

  return (
    <PortalLayout
      navItems={[
        { to: "/admin", label: "Dashboard", active: true },
        { to: "/admin/retailers", label: "Retailers", onClick: () => navigate("/admin/retailers") },
        { to: "/admin/catalog", label: "Master Catalog", onClick: () => navigate("/admin/catalog") },
        { to: "/admin/orders", label: "Order Monitoring", onClick: () => navigate("/admin/orders") },
        { to: "/admin/supply", label: "Supply Intel", onClick: () => navigate("/admin/supply") },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Platform overview</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 22 }}>
        Demand visibility and retailer performance across the network.
      </p>

      {!stats ? (
        <PageLoader />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            <StatCard label="Active retailers" value={`${stats.active_retailers} / ${stats.total_retailers}`} icon="🏪" />
            <StatCard label="Master SKUs" value={stats.total_products} icon="📦" />
            <StatCard label="Registered customers" value={stats.total_customers} icon="👥" />
            <StatCard label="Total GMV" value={`₹${stats.total_gmv.toFixed(0)}`} icon="💰" accent="var(--tomato-500)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
            <Card style={{ padding: 22 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Retailer performance</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {performance.map((p) => (
                  <div key={p.store_name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{p.store_name}</span>
                      <span>
                        ₹{p.total_sales.toFixed(0)} · {p.order_count} orders
                      </span>
                    </div>
                    <div style={{ height: 8, background: "var(--sage-100)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(p.total_sales / maxSales) * 100}%`,
                          background: "var(--forest-500)",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--charcoal-300)", marginTop: 2 }}>{p.area}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 22 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Orders by status</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {statusBreakdown.map((s) => (
                  <div key={s.status} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span style={{ textTransform: "capitalize" }}>{s.status}</span>
                    <span style={{ fontWeight: 700 }}>{s.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700 }}>
                  <span>Pending action</span>
                  <span style={{ color: "var(--amber-500)" }}>{stats.pending_orders}</span>
                </div>
              </div>
            </Card>
          </div>
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
