import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import OrderStatusRail from "../components/OrderStatusRail";
import { Card, Badge, Button, PageLoader, EmptyState } from "../components/ui";

const FILTERS = [
  { key: "", label: "All" },
  { key: "placed", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "packing", label: "Packing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

const NEXT_ACTION = {
  placed: [{ status: "accepted", label: "Accept order", variant: "success" }, { status: "rejected", label: "Reject", variant: "danger" }],
  accepted: [{ status: "packing", label: "Mark as packing", variant: "secondary" }],
  packing: [{ status: "dispatched", label: "Mark as dispatched", variant: "secondary" }],
  dispatched: [{ status: "delivered", label: "Mark as delivered", variant: "success" }],
};

export default function RetailerOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  function load() {
    api.retailerOrders(filter || undefined).then(setOrders).catch((e) => setError(e.message));
  }

  useEffect(() => {
    setOrders(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleStatusChange(orderId, status) {
    setBusyId(orderId);
    try {
      await api.updateOrderStatus(orderId, status);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalLayout
      navItems={[
        { to: "/retailer", label: "Dashboard", onClick: () => navigate("/retailer") },
        { to: "/retailer/orders", label: "Orders", active: true },
        { to: "/retailer/catalog", label: "Inventory & Pricing", onClick: () => navigate("/retailer/catalog") },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Order queue</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              border: filter === f.key ? "1.5px solid var(--forest-500)" : "1.5px solid var(--line)",
              background: filter === f.key ? "var(--sage-100)" : "var(--white)",
              fontSize: 13,
              fontWeight: 600,
              color: filter === f.key ? "var(--forest-900)" : "var(--charcoal-600)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!orders && !error && <PageLoader />}
      {orders && orders.length === 0 && <EmptyState icon="📭" title="No orders in this view" />}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {orders?.map((order) => (
          <Card key={order.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: 16 }}>Order #{order.id}</h3>
                  <Badge tone={order.payment_status === "paid" ? "success" : "warning"}>{order.payment_status}</Badge>
                </div>
                <p style={{ fontSize: 13, color: "var(--charcoal-600)", marginTop: 2 }}>
                  {order.customer_name} · {order.customer_phone} · {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>₹{order.total_amount.toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 14, padding: "0 8px" }}>
              <OrderStatusRail status={order.status} />
            </div>

            <div style={{ background: "var(--sage-100)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 14 }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                  <span>
                    {item.product_name} × {item.quantity}
                  </span>
                  <span style={{ color: "var(--charcoal-600)" }}>₹{item.line_total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {(NEXT_ACTION[order.status] || []).map((action) => (
                <Button
                  key={action.status}
                  variant={action.variant}
                  size="sm"
                  disabled={busyId === order.id}
                  onClick={() => handleStatusChange(order.id, action.status)}
                >
                  {busyId === order.id ? "Updating…" : action.label}
                </Button>
              ))}
              {!NEXT_ACTION[order.status] && (
                <span style={{ fontSize: 12.5, color: "var(--charcoal-300)" }}>No further action needed</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
