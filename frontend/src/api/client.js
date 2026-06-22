const API_BASE = "/api";  // relative — works on any Vercel domain

function getToken() {
  return localStorage.getItem("freshline_token");
}

async function request(path, { method = "GET", body, auth = true, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;
    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Server is warming up — please try again in a moment.");
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (phone, password) => request("/auth/login", { method: "POST", body: { phone, password }, auth: false }),
  register: (name, phone, password) => request("/auth/register", { method: "POST", body: { name, phone, password }, auth: false }),
  me: () => request("/auth/me"),

  // Customer
  listRetailers: () => request("/retailers", { auth: false }),
  retailerCatalog: (retailerId, q = "", category = "") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const qs = params.toString();
    return request(`/retailers/${retailerId}/catalog${qs ? `?${qs}` : ""}`, { auth: false });
  },
  listCategories: () => request("/categories", { auth: false }),
  placeOrder: (retailerId, items, deliveryAddress) =>
    request("/orders", { method: "POST", body: { retailer_id: retailerId, items, delivery_address: deliveryAddress } }),
  myOrders: () => request("/orders/mine"),
  getOrder: (orderId) => request(`/orders/${orderId}`),

  // Retailer
  retailerDashboard: () => request("/retailer/dashboard"),
  retailerOrders: (status) => request(`/retailer/orders${status ? `?status=${status}` : ""}`),
  updateOrderStatus: (orderId, status) => request(`/retailer/orders/${orderId}/status`, { method: "PATCH", body: { status } }),
  retailerOwnCatalog: () => request("/retailer/catalog"),
  updateRetailerProduct: (retailerProductId, fields) =>
    request(`/retailer/catalog/${retailerProductId}`, { method: "PATCH", body: fields }),
  retailerTopProducts: () => request("/retailer/reports/top-products"),

  // Admin
  adminDashboard: () => request("/admin/dashboard"),
  adminListRetailers: () => request("/admin/retailers"),
  adminCreateRetailer: (payload) => request("/admin/retailers", { method: "POST", body: payload }),
  adminToggleRetailer: (retailerId, status) => request(`/admin/retailers/${retailerId}/status`, { method: "PATCH", body: { status } }),
  adminListProducts: () => request("/admin/products"),
  adminCreateProduct: (payload) => request("/admin/products", { method: "POST", body: payload }),
  adminListOrders: () => request("/admin/orders"),
  adminRetailerPerformance: () => request("/admin/analytics/retailer-performance"),
  adminTopProducts: () => request("/admin/analytics/top-products"),
  adminOrderStatusBreakdown: () => request("/admin/analytics/order-status-breakdown"),

  // Notifications
  notifications: () => request("/notifications"),
};

export function saveSession(token, user) {
  localStorage.setItem("freshline_token", token);
  localStorage.setItem("freshline_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("freshline_token");
  localStorage.removeItem("freshline_user");
}

export function loadUser() {
  const raw = localStorage.getItem("freshline_user");
  return raw ? JSON.parse(raw) : null;
}
