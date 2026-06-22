import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Card, Badge, Button, PageLoader, EmptyState, ErrorBanner } from "../components/ui";

const TABS = ["Demand Gaps", "Cross-Retailer", "Stock Gaps", "Supply Orders"];

const ADMIN_NAV = (navigate) => [
  { label: "Dashboard", onClick: () => navigate("/admin") },
  { label: "Retailers", onClick: () => navigate("/admin/retailers") },
  { label: "Master Catalog", onClick: () => navigate("/admin/catalog") },
  { label: "Order Monitoring", onClick: () => navigate("/admin/orders") },
  { label: "Supply Intel", active: true },
];

export default function AdminSupplyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Demand Gaps");

  return (
    <PortalLayout navItems={ADMIN_NAV(navigate)}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Supply Intelligence</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 20 }}>
        Demand gaps, cross-retailer analytics, and supply order management.
      </p>

      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", padding: "10px 18px", fontSize: 13.5,
              fontWeight: 600, cursor: "pointer",
              color: tab === t ? "var(--forest-900)" : "var(--charcoal-600)",
              borderBottom: tab === t ? "2px solid var(--amber-500)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Demand Gaps" && <DemandGapsTab />}
      {tab === "Cross-Retailer" && <CrossRetailerTab />}
      {tab === "Stock Gaps" && <StockGapsTab />}
      {tab === "Supply Orders" && <SupplyOrdersTab />}
    </PortalLayout>
  );
}

// ── Demand Gaps ───────────────────────────────────────────────────────────────
function DemandGapsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.demandGaps().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <PageLoader label="Analysing stock levels…" />;
  if (data.length === 0)
    return <EmptyState icon="✅" title="No gaps found" subtitle="All products are adequately stocked across all retailers." />;

  return (
    <Card style={{ overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: "var(--sage-100)" }}>
            <Th>Product</Th>
            <Th>Retailer</Th>
            <Th>Stock</Th>
            <Th>Status</Th>
            <Th>Sold (30d)</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "10px 14px" }}>
                {item.image_emoji} <strong>{item.product_name}</strong>
              </td>
              <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{item.store_name}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ fontWeight: 700, color: item.quantity <= 0 ? "var(--danger)" : item.quantity < 5 ? "#c05c00" : "#94650f" }}>
                  {item.quantity} units
                </span>
              </td>
              <td style={{ padding: "10px 14px" }}>
                <Badge tone={item.in_stock ? "warning" : "danger"}>
                  {item.in_stock ? "Low stock" : "Out of stock"}
                </Badge>
              </td>
              <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{item.units_ordered_30d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── Cross-Retailer Demand ─────────────────────────────────────────────────────
function CrossRetailerTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.crossRetailerDemand().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <PageLoader label="Loading demand matrix…" />;

  const retailers = [...new Set(data.map((d) => d.store_name))];
  const products = [...new Set(data.map((d) => d.product_name))];

  const matrix = {};
  data.forEach((d) => {
    if (!matrix[d.product_name]) matrix[d.product_name] = {};
    matrix[d.product_name][d.store_name] = { qty: d.total_qty, rev: d.total_revenue };
  });

  const sorted = products
    .map((p) => ({ name: p, total: retailers.reduce((s, r) => s + (matrix[p]?.[r]?.qty || 0), 0) }))
    .sort((a, b) => b.total - a.total)
    .map((p) => p.name);

  const maxQty = Math.max(1, ...data.map((d) => d.total_qty));

  return (
    <Card style={{ overflow: "auto" }}>
      <div style={{ fontSize: 12.5, color: "var(--charcoal-600)", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        Units ordered per product × retailer — darker cell = higher volume. Use this to spot which SKUs a retailer is missing.
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
        <thead>
          <tr style={{ background: "var(--sage-100)" }}>
            <th style={thSt}>Product</th>
            {retailers.map((r) => <th key={r} style={{ ...thSt, textAlign: "center" }}>{r}</th>)}
            <th style={{ ...thSt, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((product) => {
            const total = retailers.reduce((s, r) => s + (matrix[product]?.[r]?.qty || 0), 0);
            return (
              <tr key={product} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "8px 14px", fontWeight: 500 }}>{product}</td>
                {retailers.map((r) => {
                  const qty = matrix[product]?.[r]?.qty || 0;
                  const alpha = 0.12 + (qty / maxQty) * 0.75;
                  return (
                    <td key={r} style={{ padding: "8px 14px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 4, minWidth: 36,
                        fontWeight: qty > 0 ? 700 : 400,
                        background: qty > 0 ? `rgba(74,124,89,${alpha})` : "transparent",
                        color: qty > 0 ? "var(--forest-900)" : "var(--charcoal-300)",
                      }}>
                        {qty > 0 ? qty : "—"}
                      </span>
                    </td>
                  );
                })}
                <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: total > 0 ? "var(--forest-700)" : "var(--charcoal-300)" }}>
                  {total || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ── Stock Gaps ────────────────────────────────────────────────────────────────
function StockGapsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.retailerStockGaps().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <PageLoader label="Computing stock gaps…" />;
  if (data.length === 0)
    return <EmptyState icon="✅" title="No gaps" subtitle="All retailers have full stock coverage." />;

  const byRetailer = {};
  data.forEach((item) => {
    if (!byRetailer[item.store_name]) byRetailer[item.store_name] = [];
    byRetailer[item.store_name].push(item);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Object.entries(byRetailer).map(([storeName, items]) => (
        <Card key={storeName} style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{storeName}</h3>
            <span style={{ fontSize: 12.5, color: "var(--charcoal-600)" }}>{items.length} gap{items.length !== 1 ? "s" : ""}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--cream-100)" }}>
                <Th>Product</Th>
                <Th>Gap Type</Th>
                <Th>Current Qty</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 14px" }}>{item.image_emoji} {item.product_name}</td>
                  <td style={{ padding: "8px 14px" }}>
                    <Badge tone={item.gap_type === "missing" ? "danger" : item.gap_type === "out_of_stock" ? "danger" : "warning"}>
                      {item.gap_type === "missing" ? "Not stocked" : item.gap_type === "out_of_stock" ? "Out of stock" : "Low stock"}
                    </Badge>
                  </td>
                  <td style={{ padding: "8px 14px", color: "var(--charcoal-600)" }}>
                    {item.gap_type === "missing" ? "—" : `${item.quantity} units`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

// ── Supply Orders ─────────────────────────────────────────────────────────────
const STATUS_BADGE = { confirmed: "warning", shipped: "neutral", delivered: "success", cancelled: "danger" };
const STATUS_NEXT = { confirmed: "shipped", shipped: "delivered" };

function SupplyOrdersTab() {
  const [orders, setOrders] = useState(null);
  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(() => {
    setError("");
    api.listSupplyOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api.adminListRetailers().then(setRetailers).catch(() => {});
    api.adminListProducts().then(setProducts).catch(() => {});
  }, [load]);

  async function handleStatus(soid, status) {
    setUpdating(soid);
    try {
      await api.updateSupplyOrderStatus(soid, status);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: "var(--charcoal-600)" }}>
          Supply orders dispatched from the stockist to retailers. Marking as Delivered auto-updates retailer inventory.
        </span>
        <Button onClick={() => setShowCreate(true)}>+ New Supply Order</Button>
      </div>

      <ErrorBanner message={error} />

      {showCreate && (
        <CreateSupplyOrderForm
          retailers={retailers}
          products={products}
          onSuccess={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {!orders && <PageLoader label="Loading supply orders…" />}
      {orders?.length === 0 && !showCreate && (
        <EmptyState icon="📦" title="No supply orders yet" subtitle="Create a supply order to dispatch stock from the stockist to a retailer." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: showCreate ? 16 : 0 }}>
        {orders?.map((so) => (
          <Card key={so.id} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-display)" }}>SO-{String(so.id).padStart(4, "0")}</span>
                  <Badge tone={STATUS_BADGE[so.status] || "neutral"}>{so.status}</Badge>
                  <span style={{ fontSize: 13, color: "var(--charcoal-600)" }}>→ {so.store_name}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--charcoal-300)", marginTop: 3 }}>
                  {new Date(so.created_at).toLocaleString()} · ₹{so.total_cost.toFixed(2)}
                  {so.notes ? ` · ${so.notes}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {STATUS_NEXT[so.status] && (
                  <Button size="sm" variant={STATUS_NEXT[so.status] === "delivered" ? "success" : "secondary"}
                    disabled={updating === so.id} onClick={() => handleStatus(so.id, STATUS_NEXT[so.status])}>
                    Mark {STATUS_NEXT[so.status]}
                  </Button>
                )}
                {so.status === "confirmed" && (
                  <Button size="sm" variant="danger" disabled={updating === so.id} onClick={() => handleStatus(so.id, "cancelled")}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <div style={{ padding: "10px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {so.items?.map((item) => (
                <span key={item.id} style={{ fontSize: 12.5, background: "var(--cream-100)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
                  {item.image_emoji} {item.product_name} × {item.quantity}
                  <span style={{ color: "var(--charcoal-300)", marginLeft: 4 }}>@ ₹{item.unit_cost.toFixed(2)}</span>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CreateSupplyOrderForm({ retailers, products, onSuccess, onCancel }) {
  const [retailerId, setRetailerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: 1, unit_cost: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const productMap = Object.fromEntries(products.map((p) => [String(p.id), p]));

  function addItem() { setItems((p) => [...p, { product_id: "", quantity: 1, unit_cost: "" }]); }
  function removeItem(i) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i, field, value) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "product_id" && productMap[value]) next[i].unit_cost = String(productMap[value].base_price);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!retailerId) { setError("Select a retailer"); return; }
    const valid = items.filter((it) => it.product_id && parseInt(it.quantity) > 0);
    if (!valid.length) { setError("Add at least one product with quantity > 0"); return; }
    setSaving(true);
    try {
      await api.createSupplyOrder({
        retailer_id: parseInt(retailerId),
        notes,
        items: valid.map((it) => ({
          product_id: parseInt(it.product_id),
          quantity: parseInt(it.quantity),
          unit_cost: parseFloat(it.unit_cost) || productMap[it.product_id]?.base_price || 0,
        })),
      });
      onSuccess();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const total = items.reduce((s, it) => {
    const qty = parseInt(it.quantity) || 0;
    const cost = parseFloat(it.unit_cost) || productMap[it.product_id]?.base_price || 0;
    return s + qty * cost;
  }, 0);

  return (
    <Card style={{ padding: 24, marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>New Supply Order</h3>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Retailer</label>
            <select value={retailerId} onChange={(e) => setRetailerId(e.target.value)} style={inp} required>
              <option value="">Select retailer…</option>
              {retailers.map((r) => <option key={r.id} value={r.id}>{r.store_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Urgent restock" style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Products</label>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>+ Add row</Button>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 70px 90px 28px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select value={item.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)} style={inp}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.image_emoji} {p.name}</option>)}
              </select>
              <input type="number" min={1} value={item.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" style={inp} />
              <input type="number" min={0} step="0.01" value={item.unit_cost}
                onChange={(e) => updateItem(i, "unit_cost", e.target.value)} placeholder="₹/unit" style={inp} />
              <button type="button" onClick={() => removeItem(i)}
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Total: ₹{total.toFixed(2)}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="secondary" disabled={saving}>{saving ? "Creating…" : "Create & Confirm"}</Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function Th({ children }) {
  return <th style={thSt}>{children}</th>;
}

const thSt = { padding: "10px 14px", fontWeight: 600, color: "var(--forest-900)", fontSize: 12.5, textAlign: "left" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--charcoal-600)", marginBottom: 6 };
const inp = { width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--white)", boxSizing: "border-box" };
