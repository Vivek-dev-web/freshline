import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, Badge, PageLoader, EmptyState } from "../components/ui";

const STATUS_BADGE = { confirmed: "warning", shipped: "neutral", delivered: "success", cancelled: "danger" };
const STATUS_LABEL = { confirmed: "Confirmed — awaiting dispatch", shipped: "In transit", delivered: "Delivered", cancelled: "Cancelled" };

export default function RetailerSupplyOrdersPage() {
  const [orders, setOrders] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.retailerSupplyOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <PortalLayout
      navItems={[
        { label: "Dashboard", onClick: () => navigate("/retailer") },
        { label: "Orders", onClick: () => navigate("/retailer/orders") },
        { label: "Inventory & Pricing", onClick: () => navigate("/retailer/catalog") },
        { label: "Supply Orders", active: true },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Incoming Supply Orders</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 20 }}>
        Stock dispatched to you by the stockist. Your inventory is updated automatically when an order is marked as delivered.
      </p>

      {!orders && <PageLoader label="Loading supply orders…" />}
      {orders?.length === 0 && (
        <EmptyState icon="📦" title="No supply orders yet" subtitle="The stockist hasn't dispatched any supply orders to you yet." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {orders?.map((so) => (
          <Card key={so.id} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 16 }}>
                    SO-{String(so.id).padStart(4, "0")}
                  </span>
                  <Badge tone={STATUS_BADGE[so.status] || "neutral"}>{so.status}</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--charcoal-300)", marginTop: 3 }}>
                  {STATUS_LABEL[so.status]} · {new Date(so.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>₹{so.total_cost.toFixed(2)}</div>
                <div style={{ fontSize: 12.5, color: "var(--charcoal-600)" }}>{so.items?.length || 0} product{so.items?.length !== 1 ? "s" : ""}</div>
              </div>
            </div>

            {so.notes && (
              <div style={{ padding: "8px 18px", fontSize: 13, color: "var(--charcoal-600)", background: "var(--cream-100)", borderBottom: "1px solid var(--line)" }}>
                Note from stockist: {so.notes}
              </div>
            )}

            <div style={{ padding: "12px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {so.items?.map((item) => (
                  <div key={item.id} style={{
                    fontSize: 13, background: "var(--sage-100)", padding: "6px 12px",
                    borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                    border: "1px solid var(--line)",
                  }}>
                    <span style={{ fontSize: 16 }}>{item.image_emoji}</span>
                    <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                    <span style={{ color: "var(--charcoal-600)" }}>× {item.quantity}</span>
                    <span style={{ color: "var(--charcoal-300)", fontSize: 11.5 }}>@ ₹{item.unit_cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {so.status === "delivered" && (
                <p style={{ fontSize: 12.5, color: "var(--success)", marginTop: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  ✅ Inventory updated — quantities have been added to your catalog
                </p>
              )}
              {so.status === "shipped" && (
                <p style={{ fontSize: 12.5, color: "#94650f", marginTop: 10, fontWeight: 600 }}>
                  🚚 Your order is on the way — inventory will update automatically on delivery
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
