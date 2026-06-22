import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [retailerId, setRetailerId] = useState(null);
  const [retailerName, setRetailerName] = useState(null);
  const [items, setItems] = useState({}); // key: retailer_product_id -> {product, quantity}

  const addItem = useCallback((rId, rName, product, qty = 1) => {
    setRetailerId((prev) => {
      if (prev !== null && prev !== rId) {
        // switching retailers clears the cart (each retailer has its own catalog/pricing)
        setItems({});
      }
      return rId;
    });
    setRetailerName(rName);
    setItems((prev) => {
      const existing = prev[product.retailer_product_id];
      const nextQty = (existing?.quantity || 0) + qty;
      return { ...prev, [product.retailer_product_id]: { product, quantity: nextQty } };
    });
  }, []);

  const updateQty = useCallback((retailerProductId, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[retailerProductId];
        return next;
      }
      return { ...prev, [retailerProductId]: { ...prev[retailerProductId], quantity: qty } };
    });
  }, []);

  const removeItem = useCallback((retailerProductId) => {
    setItems((prev) => {
      const next = { ...prev };
      delete next[retailerProductId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems({});
    setRetailerId(null);
    setRetailerName(null);
  }, []);

  const itemList = useMemo(() => Object.values(items), [items]);
  const totalCount = useMemo(() => itemList.reduce((s, i) => s + i.quantity, 0), [itemList]);
  const totalAmount = useMemo(
    () => itemList.reduce((s, i) => s + i.quantity * i.product.selling_price, 0),
    [itemList]
  );

  return (
    <CartContext.Provider
      value={{
        retailerId,
        retailerName,
        items: itemList,
        totalCount,
        totalAmount,
        addItem,
        updateQty,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
