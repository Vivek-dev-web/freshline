import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import PortalLayout from "../components/PortalLayout";
import { Button, Badge, PageLoader, EmptyState } from "../components/ui";

export default function CatalogPage() {
  const { retailerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();

  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const storeName = location.state?.storeName || cart.retailerName || "Store";

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setProducts(null);
    api
      .retailerCatalog(retailerId, search, activeCategory)
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [retailerId, search, activeCategory]);

  function handleAdd(product) {
    cart.addItem(Number(retailerId), storeName, product, 1);
  }

  const cartQtyFor = (id) => cart.items.find((i) => i.product.retailer_product_id === id)?.quantity || 0;

  return (
    <PortalLayout
      navItems={[
        { to: "/shop", label: "Browse Retailers", onClick: () => navigate("/shop") },
        { to: "/shop/orders", label: "My Orders", onClick: () => navigate("/shop/orders") },
      ]}
      rightSlot={
        <Button variant="secondary" onClick={() => navigate("/shop/cart")} style={{ position: "relative" }}>
          🛒 Cart
          {cart.totalCount > 0 && (
            <span
              style={{
                background: "var(--tomato-500)",
                color: "#fff",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 7px",
                marginLeft: 2,
              }}
            >
              {cart.totalCount}
            </span>
          )}
        </Button>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12.5, color: "var(--charcoal-300)", marginBottom: 2 }}>Shopping at</p>
        <h1 style={{ fontSize: 24 }}>{storeName}</h1>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 240px",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid var(--line)",
            fontSize: 14,
            background: "var(--white)",
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <CategoryChip label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
          {categories.map((c) => (
            <CategoryChip key={c.id} label={c.name} active={activeCategory === c.name} onClick={() => setActiveCategory(c.name)} />
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!products && !error && <PageLoader label="Loading catalog…" />}

      {products && products.length === 0 && (
        <EmptyState icon="🔍" title="No products found" subtitle="Try a different search term or category." />
      )}

      {products && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {products.map((p) => (
            <ProductCard key={p.retailer_product_id} product={p} qtyInCart={cartQtyFor(p.retailer_product_id)} onAdd={() => handleAdd(p)} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px",
        borderRadius: 999,
        border: active ? "1.5px solid var(--forest-500)" : "1.5px solid var(--line)",
        background: active ? "var(--sage-100)" : "var(--white)",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "var(--forest-900)" : "var(--charcoal-600)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function ProductCard({ product, qtyInCart, onAdd }) {
  const outOfStock = !product.in_stock || product.quantity <= 0;
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        opacity: outOfStock ? 0.6 : 1,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>{product.image_emoji}</div>
      <div style={{ fontSize: 11, color: "var(--charcoal-300)", marginBottom: 2 }}>{product.category}</div>
      <h4 style={{ fontSize: 14.5, marginBottom: 2, fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--charcoal-900)" }}>
        {product.name}
      </h4>
      <p style={{ fontSize: 12, color: "var(--charcoal-600)", marginBottom: 10 }}>
        {product.brand} · {product.pack_size}
      </p>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--forest-900)" }}>₹{product.selling_price.toFixed(2)}</span>
        {outOfStock ? (
          <Badge tone="danger">Out of stock</Badge>
        ) : (
          <Button size="sm" variant={qtyInCart > 0 ? "success" : "primary"} onClick={onAdd}>
            {qtyInCart > 0 ? `In cart · ${qtyInCart}` : "Add"}
          </Button>
        )}
      </div>
    </div>
  );
}
