import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import OrderStatusRail from "../components/OrderStatusRail";
import { Card, Badge, PageLoader, EmptyState, Button, ErrorBanner } from "../components/ui";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState(null);
  const navigate = useNavigate();

  function reload() {
    api.myOrders().then(setOrders).catch((e) => setError(e.message));
  }

  useEffect(() => { reload(); }, []);

  function handlePaid(updatedOrder) {
    setPayingId(null);
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? { ...o, payment_status: "paid" } : o)));
  }

  return (
    <PortalLayout
      navItems={[
        { to: "/shop", label: "Browse Retailers", onClick: () => navigate("/shop") },
        { to: "/shop/orders", label: "My Orders", active: true },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>My orders</h1>

      <ErrorBanner message={error} />
      {payingId && <PaymentModal orderId={payingId} onSuccess={handlePaid} onClose={() => setPayingId(null)} />}
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
                  {order.payment_status !== "paid" && (
                    <Button size="sm" variant="primary" onClick={() => setPayingId(order.id)}>Pay Now</Button>
                  )}
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

function PaymentModal({ orderId, onSuccess, onClose }) {
  const [cardNo, setCardNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [stage, setStage] = useState("form");
  const [error, setError] = useState("");

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setStage("processing");
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const last4 = cardNo.replace(/\s/g, "").slice(-4) || "0000";
      const updated = await api.payOrder(orderId, last4);
      setStage("done");
      await new Promise((r) => setTimeout(r, 700));
      onSuccess(updated);
    } catch (e) {
      setError(e.message);
      setStage("form");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", padding: 32, width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <h3 style={{ fontSize: 18, marginBottom: 4 }}>Complete payment</h3>
        <p style={{ fontSize: 13, color: "var(--charcoal-600)", marginBottom: 20 }}>Order #{orderId} · Simulated card payment</p>

        {stage === "processing" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>💳</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--charcoal-600)" }}>Processing payment…</p>
          </div>
        )}
        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Payment confirmed!</p>
          </div>
        )}
        {stage === "form" && (
          <form onSubmit={handlePay}>
            <ErrorBanner message={error} />
            <label style={lbl}>Card number</label>
            <input style={inp} placeholder="4242 4242 4242 4242" value={cardNo}
              onChange={(e) => setCardNo(e.target.value)} required maxLength={19} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>Expiry</label>
                <input style={inp} placeholder="MM / YY" value={expiry}
                  onChange={(e) => setExpiry(e.target.value)} required maxLength={7} />
              </div>
              <div>
                <label style={lbl}>CVV</label>
                <input style={inp} placeholder="•••" value={cvv} type="password"
                  onChange={(e) => setCvv(e.target.value)} required maxLength={4} />
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--charcoal-300)", marginTop: 10 }}>
              Demo only — no real card data is processed or stored.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Button type="button" variant="outline" style={{ flex: 1 }} onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" style={{ flex: 2 }}>Pay now</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--charcoal-600)", marginBottom: 6 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--line)", fontSize: 14, background: "var(--white)", boxSizing: "border-box" };
