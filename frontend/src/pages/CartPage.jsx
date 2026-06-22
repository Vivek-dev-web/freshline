import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import PortalLayout from "../components/PortalLayout";
import { Button, Card, EmptyState, ErrorBanner } from "../components/ui";

const STEPS = ["cart", "address", "payment", "confirmed"];

export default function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState("cart");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [payStage, setPayStage] = useState("");

  async function handlePlaceOrder() {
    setError("");
    setPlacing(true);
    setPayStage("Connecting to payment gateway (mock)…");
    await sleep(700);
    setPayStage("Authorizing payment…");
    await sleep(700);
    try {
      const order = await api.placeOrder(
        cart.retailerId,
        cart.items.map((i) => ({ retailer_product_id: i.product.retailer_product_id, quantity: i.quantity })),
        address
      );
      setPayStage("Payment confirmed");
      await sleep(400);
      setConfirmedOrder(order);
      setStep("confirmed");
      cart.clearCart();
    } catch (e) {
      setError(e.message);
      setStep("payment");
    } finally {
      setPlacing(false);
    }
  }

  if (step !== "confirmed" && cart.items.length === 0) {
    return (
      <PortalLayout navItems={[{ to: "/shop", label: "Browse Retailers", onClick: () => navigate("/shop") }]}>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          subtitle="Pick a retailer and add a few products to get started."
          action={<Button onClick={() => navigate("/shop")}>Browse retailers</Button>}
        />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout navItems={[{ to: "/shop", label: "Browse Retailers", onClick: () => navigate("/shop") }]}>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>
        {step === "confirmed" ? "Order confirmed" : `Checkout · ${cart.retailerName}`}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: step === "confirmed" ? "1fr" : "1.4fr 1fr", gap: 24 }}>
        <div>
          {step === "cart" && (
            <Card style={{ padding: 4 }}>
              {cart.items.map((item) => (
                <CartRow key={item.product.retailer_product_id} item={item} cart={cart} />
              ))}
            </Card>
          )}

          {step === "address" && (
            <Card style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Delivery address</h3>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House no, street, area, city, pincode"
                rows={4}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px solid var(--line)",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "var(--font-body)",
                }}
              />
            </Card>
          )}

          {step === "payment" && (
            <Card style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Payment</h3>
              <p style={{ fontSize: 13, color: "var(--charcoal-600)", marginBottom: 18 }}>
                Simulated gateway for this MVP demo — production build integrates Razorpay Route /
                Cashfree Marketplace for direct retailer settlement, per proposal Section 12.
              </p>
              <ErrorBanner message={error} />
              <div
                style={{
                  border: "1.5px dashed var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: 20,
                  background: "var(--sage-100)",
                  textAlign: "center",
                }}
              >
                {placing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 26 }}>💳</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{payStage}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 26 }}>💳</span>
                    <span style={{ fontSize: 13.5, color: "var(--charcoal-600)" }}>
                      Mock UPI / Card payment of <strong>₹{cart.totalAmount.toFixed(2)}</strong>
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {step === "confirmed" && confirmedOrder && (
            <Card style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 22, marginBottom: 6 }}>Order #{confirmedOrder.id} placed</h2>
              <p style={{ color: "var(--charcoal-600)", fontSize: 14, marginBottom: 20 }}>
                Payment of ₹{confirmedOrder.total_amount.toFixed(2)} confirmed. The retailer has been notified.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <Button variant="outline" onClick={() => navigate("/shop")}>
                  Continue shopping
                </Button>
                <Button onClick={() => navigate("/shop/orders")}>Track order</Button>
              </div>
            </Card>
          )}
        </div>

        {step !== "confirmed" && (
          <Card style={{ padding: 20, alignSelf: "start" }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Order summary</h3>
            <SummaryRow label="Items" value={cart.totalCount} />
            <SummaryRow label="Subtotal" value={`₹${cart.totalAmount.toFixed(2)}`} />
            <SummaryRow label="Delivery" value="Free (MVP)" />
            <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0" }} />
            <SummaryRow label="Total" value={`₹${cart.totalAmount.toFixed(2)}`} bold />

            <StepFooter step={step} setStep={setStep} address={address} onPlaceOrder={handlePlaceOrder} placing={placing} />
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

function CartRow({ item, cart }) {
  const { product, quantity } = item;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: 26 }}>{product.image_emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--charcoal-600)" }}>₹{product.selling_price.toFixed(2)} each</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <QtyButton onClick={() => cart.updateQty(product.retailer_product_id, quantity - 1)}>−</QtyButton>
        <span style={{ width: 24, textAlign: "center", fontWeight: 600 }}>{quantity}</span>
        <QtyButton onClick={() => cart.updateQty(product.retailer_product_id, quantity + 1)}>+</QtyButton>
      </div>
      <div style={{ width: 70, textAlign: "right", fontWeight: 700 }}>₹{(product.selling_price * quantity).toFixed(2)}</div>
      <button
        onClick={() => cart.removeItem(product.retailer_product_id)}
        style={{ background: "none", border: "none", color: "var(--charcoal-300)", fontSize: 13 }}
      >
        ✕
      </button>
    </div>
  );
}

function QtyButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "1px solid var(--line)",
        background: "var(--white)",
        fontSize: 14,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: bold ? 15 : 13.5, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: bold ? "var(--charcoal-900)" : "var(--charcoal-600)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StepFooter({ step, setStep, address, onPlaceOrder, placing }) {
  if (step === "cart") {
    return (
      <Button style={{ width: "100%", marginTop: 8 }} onClick={() => setStep("address")}>
        Proceed to address
      </Button>
    );
  }
  if (step === "address") {
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button variant="outline" onClick={() => setStep("cart")}>
          Back
        </Button>
        <Button style={{ flex: 1 }} disabled={!address.trim()} onClick={() => setStep("payment")}>
          Proceed to payment
        </Button>
      </div>
    );
  }
  if (step === "payment") {
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button variant="outline" onClick={() => setStep("address")} disabled={placing}>
          Back
        </Button>
        <Button style={{ flex: 1 }} onClick={onPlaceOrder} disabled={placing}>
          {placing ? "Processing…" : "Pay & place order"}
        </Button>
      </div>
    );
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
