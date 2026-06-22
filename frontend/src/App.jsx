import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RetailerSelectPage from "./pages/RetailerSelectPage";
import CatalogPage from "./pages/CatalogPage";
import CartPage from "./pages/CartPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import RetailerDashboardPage from "./pages/RetailerDashboardPage";
import RetailerOrdersPage from "./pages/RetailerOrdersPage";
import RetailerCatalogPage from "./pages/RetailerCatalogPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminRetailersPage from "./pages/AdminRetailersPage";
import AdminCatalogPage from "./pages/AdminCatalogPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminSupplyPage from "./pages/AdminSupplyPage";
import RetailerSupplyOrdersPage from "./pages/RetailerSupplyOrdersPage";

function homeForRole(role) {
  if (role === "customer") return "/shop";
  if (role === "retailer") return "/retailer";
  if (role === "admin") return "/admin";
  return "/login";
}

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeForRole(user.role) : "/login"} replace />;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

      {/* Customer */}
      <Route path="/shop" element={<RequireRole role="customer"><RetailerSelectPage /></RequireRole>} />
      <Route path="/shop/retailer/:retailerId" element={<RequireRole role="customer"><CatalogPage /></RequireRole>} />
      <Route path="/shop/cart" element={<RequireRole role="customer"><CartPage /></RequireRole>} />
      <Route path="/shop/orders" element={<RequireRole role="customer"><MyOrdersPage /></RequireRole>} />

      {/* Retailer */}
      <Route path="/retailer" element={<RequireRole role="retailer"><RetailerDashboardPage /></RequireRole>} />
      <Route path="/retailer/orders" element={<RequireRole role="retailer"><RetailerOrdersPage /></RequireRole>} />
      <Route path="/retailer/catalog" element={<RequireRole role="retailer"><RetailerCatalogPage /></RequireRole>} />
      <Route path="/retailer/supply-orders" element={<RequireRole role="retailer"><RetailerSupplyOrdersPage /></RequireRole>} />

      {/* Admin */}
      <Route path="/admin" element={<RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
      <Route path="/admin/retailers" element={<RequireRole role="admin"><AdminRetailersPage /></RequireRole>} />
      <Route path="/admin/catalog" element={<RequireRole role="admin"><AdminCatalogPage /></RequireRole>} />
      <Route path="/admin/orders" element={<RequireRole role="admin"><AdminOrdersPage /></RequireRole>} />
      <Route path="/admin/supply" element={<RequireRole role="admin"><AdminSupplyPage /></RequireRole>} />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
