import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, Button, PageLoader, ErrorBanner } from "../components/ui";

export default function AdminCatalogPage() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  function load() {
    api.adminListProducts().then(setProducts).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.listCategories().then(setCategories);
  }, []);

  async function handleCreate(payload) {
    setError("");
    try {
      await api.adminCreateProduct(payload);
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
        { to: "/admin/retailers", label: "Retailers", onClick: () => navigate("/admin/retailers") },
        { to: "/admin/catalog", label: "Master Catalog", active: true },
        { to: "/admin/orders", label: "Order Monitoring", onClick: () => navigate("/admin/orders") },
      ]}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Master catalog</h1>
          <p style={{ color: "var(--charcoal-600)", fontSize: 14 }}>
            SKUs owned by the platform — name, brand, category, GST, and base price.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Add product</Button>
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <AddProductForm categories={categories} onCancel={() => setShowForm(false)} onSubmit={handleCreate} />
      )}

      {!products && !error && <PageLoader />}

      {products && (
        <div style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--sage-100)", textAlign: "left" }}>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Category</Th>
                <Th>Pack size</Th>
                <Th>Base price</Th>
                <Th>GST</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ marginRight: 8 }}>{p.image_emoji}</span>
                    <strong>{p.name}</strong>{" "}
                    <span style={{ color: "var(--charcoal-300)", fontSize: 12 }}>{p.brand}</span>
                  </td>
                  <td className="mono" style={{ padding: "10px 14px", color: "var(--charcoal-300)" }}>{p.sku_code}</td>
                  <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{p.category}</td>
                  <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{p.pack_size}</td>
                  <td style={{ padding: "10px 14px" }}>₹{p.base_price.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{p.gst_rate}%</td>
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

function AddProductForm({ categories, onCancel, onSubmit }) {
  const [form, setForm] = useState({ name: "", brand: "", category_id: "", pack_size: "", base_price: "", gst_rate: "5", image_emoji: "🛒" });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ ...form, category_id: Number(form.category_id), base_price: parseFloat(form.base_price), gst_rate: parseFloat(form.gst_rate) });
  }

  return (
    <Card style={{ padding: 22, marginBottom: 20 }}>
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Add a product to the master catalog</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <FormField label="Product name" value={form.name} onChange={(v) => set("name", v)} required />
          <FormField label="Brand" value={form.brand} onChange={(v) => set("brand", v)} />
          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Pack size" value={form.pack_size} onChange={(v) => set("pack_size", v)} placeholder="e.g. 1 kg" />
          <FormField label="Base price (₹)" value={form.base_price} onChange={(v) => set("base_price", v)} type="number" required />
          <FormField label="GST rate (%)" value={form.gst_rate} onChange={(v) => set("gst_rate", v)} type="number" />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--charcoal-600)", marginBottom: 14 }}>
          New products are automatically mapped into every active retailer's catalog with an 8% default markup.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Add product</Button>
        </div>
      </form>
    </Card>
  );
}

function FormField({ label, value, onChange, type = "text", required, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={inputStyle}
      />
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--charcoal-600)", marginBottom: 5 };
const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--line)", fontSize: 14, background: "var(--white)" };
