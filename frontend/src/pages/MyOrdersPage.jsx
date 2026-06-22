import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import OrderStatusRail from "../components/OrderStatusRail";
import { Card, Badge, PageLoader, EmptyState, Button } from "../components/ui";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.myOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  return (
    <PortalLayout
      navItems={[
        { to: "/shop", label: "Browse Retailers", onClick: () => navigate("/shop") },
        { to: "/shop/orders", label: "My Orders", active: true },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>My orders</h1>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!orders && !error && <PageLoader label="Loading your orders…" />}

      {orders && orders.length === 0 && (
        <EmptyState
          icon="📦"
          title="No orders yet"
          subtitle="Once you place an order, you can track its progress here."
          action={<Button onClick={() => navigate("/shop")}>Start shopping</Button>}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {orders?.map((order) => (
          <Card key={order.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: 16 }}>Order #{order.id}</h3>
                  <Badge tone={order.payment_status === "paid" ? "success" : "warning"}>{order.payment_status}</Badge>
                </div>
                <p style={{ fontSize: 13, color: "var(--charcoal-600)", marginTop: 2 }}>
                  {order.store_name} · {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>₹{order.total_amount.toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 16, padding: "0 8px" }}>
              <OrderStatusRail status={order.status} />
            </div>

            <details>
              <summary style={{ fontSize: 13, color: "var(--forest-700)", fontWeight: 600, cursor: "pointer" }}>
                {order.items.length} item{order.items.length > 1 ? "s" : ""}
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {order.items.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span style={{ color: "var(--charcoal-600)" }}>₹{item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
