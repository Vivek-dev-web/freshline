import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, Badge, Button, PageLoader, ErrorBanner } from "../components/ui";

export default function AdminRetailersPage() {
  const [retailers, setRetailers] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creds, setCreds] = useState(null);
  const navigate = useNavigate();

  function load() {
    api.adminListRetailers().then(setRetailers).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(retailerId, currentStatus) {
    const next = currentStatus === "active" ? "inactive" : "active";
    try {
      await api.adminToggleRetailer(retailerId, next);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(payload) {
    setError("");
    try {
      const result = await api.adminCreateRetailer(payload);
      setCreds({ store_name: result.store_name, login_phone: result.login_phone, login_password: result.login_password });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <PortalLayout
      navItems={[
        { to: "/admin", label: "Dashboard", onClick: () => navigate("/admin") },
        { to: "/admin/retailers", label: "Retailers", active: true },
        { to: "/admin/catalog", label: "Master Catalog", onClick: () => navigate("/admin/catalog") },
        { to: "/admin/orders", label: "Order Monitoring", onClick: () => navigate("/admin/orders") },
      ]}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Retailers</h1>
          <p style={{ color: "var(--charcoal-600)", fontSize: 14 }}>Onboard new retailers and manage their access.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Onboard retailer</Button>
      </div>

      <ErrorBanner message={error} />

      {creds && (
        <Card style={{ padding: 18, marginBottom: 18, background: "var(--sage-100)", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{creds.store_name}</strong> onboarded. Login credentials created automatically:{" "}
              <span className="mono">{creds.login_phone}</span> / <span className="mono">{creds.login_password}</span>
            </div>
            <button onClick={() => setCreds(null)} style={{ background: "none", border: "none", fontSize: 16 }}>
              ✕
            </button>
          </div>
        </Card>
      )}

      {showForm && <OnboardForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}

      {!retailers && !error && <PageLoader />}

      {retailers && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {retailers.map((r) => (
            <Card key={r.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <h3 style={{ fontSize: 16 }}>{r.store_name}</h3>
                <Badge tone={r.status === "active" ? "success" : "danger"}>{r.status}</Badge>
              </div>
              <p style={{ fontSize: 13, color: "var(--charcoal-600)", marginBottom: 2 }}>{r.owner_name} · {r.area}</p>
              <p className="mono" style={{ fontSize: 12, color: "var(--charcoal-300)", marginBottom: 14 }}>{r.phone}</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14 }}>
                <span>{r.order_count} orders</span>
                <span style={{ fontWeight: 700 }}>₹{r.total_sales.toFixed(0)} sales</span>
              </div>
              <Button
                size="sm"
                variant={r.status === "active" ? "danger" : "success"}
                style={{ width: "100%" }}
                onClick={() => handleToggle(r.id, r.status)}
              >
                {r.status === "active" ? "Deactivate" : "Reactivate"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}

function OnboardForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({ store_name: "", owner_name: "", area: "", phone: "" });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Card style={{ padding: 22, marginBottom: 20 }}>
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Onboard a new retailer</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <FormField label="Store name" value={form.store_name} onChange={(v) => set("store_name", v)} />
          <FormField label="Owner name" value={form.owner_name} onChange={(v) => set("owner_name", v)} />
          <FormField label="Area" value={form.area} onChange={(v) => set("area", v)} />
          <FormField label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--charcoal-600)", marginBottom: 14 }}>
          On creation, the full master catalog is automatically mapped to this retailer with an 8% default markup,
          and a retailer-portal login is created using the phone number above.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Create retailer</Button>
        </div>
      </form>
    </Card>
  );
}

function FormField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--charcoal-600)", marginBottom: 5 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--line)", fontSize: 14 }}
      />
    </div>
  );
}
