import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PortalLayout from "../components/PortalLayout";
import { Badge, PageLoader, ErrorBanner } from "../components/ui";

export default function RetailerCatalogPage() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.retailerOwnCatalog().then(setProducts).catch((e) => setError(e.message));
  }, []);

  async function handleUpdate(retailerProductId, fields) {
    setSavingId(retailerProductId);
    setError("");
    try {
      const updated = await api.updateRetailerProduct(retailerProductId, fields);
      setProducts((prev) =>
        prev.map((p) => (p.retailer_product_id === retailerProductId ? { ...p, ...updated } : p))
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PortalLayout
      navItems={[
        { to: "/retailer", label: "Dashboard", onClick: () => navigate("/retailer") },
        { to: "/retailer/orders", label: "Orders", onClick: () => navigate("/retailer/orders") },
        { to: "/retailer/catalog", label: "Inventory & Pricing", active: true },
      ]}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Inventory & pricing</h1>
      <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 20 }}>
        Set your own selling price and stock status for each product in the master catalog.
      </p>

      <ErrorBanner message={error} />

      {!products && !error && <PageLoader />}

      {products && (
        <div style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--sage-100)", textAlign: "left" }}>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>SKU</Th>
                <Th>Base price</Th>
                <Th>Selling price</Th>
                <Th>Quantity</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRow key={p.retailer_product_id} product={p} onUpdate={handleUpdate} saving={savingId === p.retailer_product_id} />
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

function ProductRow({ product, onUpdate, saving }) {
  const [price, setPrice] = useState(product.selling_price);
  const [qty, setQty] = useState(product.quantity);

  function commitPrice() {
    const value = parseFloat(price);
    if (!isNaN(value) && value !== product.selling_price) onUpdate(product.retailer_product_id, { selling_price: value });
  }

  function commitQty() {
    const value = parseInt(qty, 10);
    if (!isNaN(value) && value !== product.quantity) onUpdate(product.retailer_product_id, { quantity: value });
  }

  function toggleStock() {
    onUpdate(product.retailer_product_id, { in_stock: product.in_stock ? 0 : 1 });
  }

  return (
    <tr style={{ borderTop: "1px solid var(--line)" }}>
      <td style={{ padding: "10px 14px" }}>
        <span style={{ marginRight: 8 }}>{product.image_emoji}</span>
        <strong>{product.name}</strong>{" "}
        <span style={{ color: "var(--charcoal-300)", fontSize: 12 }}>
          {product.brand} · {product.pack_size}
        </span>
      </td>
      <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>{product.category}</td>
      <td className="mono" style={{ padding: "10px 14px", color: "var(--charcoal-300)" }}>
        {product.sku_code}
      </td>
      <td style={{ padding: "10px 14px", color: "var(--charcoal-600)" }}>₹{product.base_price.toFixed(2)}</td>
      <td style={{ padding: "10px 14px" }}>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commitPrice}
          step="0.01"
          style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
        />
      </td>
      <td style={{ padding: "10px 14px" }}>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={commitQty}
          style={{ width: 64, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
        />
      </td>
      <td style={{ padding: "10px 14px" }}>
        <button onClick={toggleStock} disabled={saving} style={{ background: "none", border: "none", padding: 0 }}>
          <Badge tone={product.in_stock ? "success" : "danger"}>{product.in_stock ? "In stock" : "Out of stock"}</Badge>
        </button>
      </td>
    </tr>
  );
}
