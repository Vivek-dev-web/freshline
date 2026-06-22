import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Badge, PageLoader, ErrorBanner } from "../components/ui";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.adminListOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  return (
    <PortalLayout
      navItems={[
        { to: "/admin", label: "Dashboard", onClick: () => navigate("/admin") },
        { to: "/admin/retailers", label: "Retailers", onClick: () => navigate("/admin/retailers") },
        { to: "/admin/catalog", label: "Master Catalog", onClick: () => navigate("/admin/catalog") },
        { to: "/admin/orders", label: "Order Monitoring", active: true },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Order monitoring</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 20 }}>
        Cross-retailer visibility into every order on the platform.
      </p>

      <ErrorBanner message={error} />
      {!orders && !error && <PageLoader />}

      {orders && (
        <div style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--sage-100)", textAlign: "left" }}>
                <Th>Order</Th>
                <Th>Retailer</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Placed</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "10px 14px" }}>#{o.id}</td>
                  <td style={{ padding: "10px 14px" }}>{o.store_name}</td>
                  <td style={{ padding: "10px 14px" }}>{o.customer_name}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge tone={o.payment_status === "paid" ? "success" : "warning"}>{o.payment_status}</Badge>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>₹{o.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}

function Th({ children }) {
  return <th style={{ padding: "10px 14px", fontWeight: 600, color: "var(--forest-900)", fontSize: 12.5 }}>{children}</th>;
}

function statusTone(status) {
  if (status === "delivered") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "placed") return "neutral";
  return "warning";
}
