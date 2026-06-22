"""
FreshLine API — Flask app for Vercel Python serverless deployment.
Vercel runs this as a single serverless function at /api/index.py
All routes are prefixed with /api/ and handled by Flask.
"""
import os
import datetime
from functools import wraps

import jwt
from flask import Flask, request, jsonify, g

from database import get_conn, dict_cursor, hash_password, now, init_db

app = Flask(__name__)
SECRET_KEY = os.environ.get("JWT_SECRET", "grocery-mvp-change-in-production")
TOKEN_EXPIRY_HOURS = 12

# Initialize DB on cold start (Neon is serverless so this is safe)
_db_initialized = False

def ensure_db():
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


@app.before_request
def before():
    ensure_db()


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.route("/api/<path:p>", methods=["OPTIONS"])
def options(p):
    return "", 200


# ── Auth helpers ─────────────────────────────────────────────────────────────

def make_token(user):
    payload = {
        "user_id": user["id"],
        "role": user["role"],
        "retailer_id": user["retailer_id"],
        "name": user["name"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def auth_required(allowed_roles=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify({"error": "Missing or invalid Authorization header"}), 401
            try:
                payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=["HS256"])
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid token"}), 401
            if allowed_roles and payload["role"] not in allowed_roles:
                return jsonify({"error": "Access denied"}), 403
            g.user = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def row(cur):
    r = cur.fetchone()
    return dict(r) if r else None


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM users WHERE phone = %s", (phone,))
    user = row(cur)
    conn.close()
    if not user or user["password_hash"] != hash_password(password):
        return jsonify({"error": "Invalid phone number or password"}), 401
    token = make_token(user)
    return jsonify({"token": token, "user": {
        "id": user["id"], "name": user["name"], "phone": user["phone"],
        "role": user["role"], "retailer_id": user["retailer_id"],
    }})


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    if not name or not phone or not password:
        return jsonify({"error": "Name, phone and password are required"}), 400
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT id FROM users WHERE phone = %s", (phone,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Phone number already registered"}), 409
    cur.execute(
        "INSERT INTO users (name, phone, password_hash, role, retailer_id, created_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
        (name, phone, hash_password(password), "customer", None, now()),
    )
    uid = cur.fetchone()["id"]
    conn.commit()
    cur.execute("SELECT * FROM users WHERE id = %s", (uid,))
    user = row(cur)
    conn.close()
    return jsonify({"token": make_token(user), "user": {
        "id": user["id"], "name": user["name"], "phone": user["phone"],
        "role": user["role"], "retailer_id": user["retailer_id"],
    }}), 201


@app.route("/api/auth/me", methods=["GET"])
@auth_required()
def me():
    return jsonify(g.user)


# ── Customer ──────────────────────────────────────────────────────────────────

@app.route("/api/retailers", methods=["GET"])
def list_retailers():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM retailers WHERE status='active' ORDER BY store_name")
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/retailers/<int:rid>/catalog", methods=["GET"])
def retailer_catalog(rid):
    q = request.args.get("q", "").strip().lower()
    category = request.args.get("category", "").strip()
    conn = get_conn()
    cur = dict_cursor(conn)
    sql = """SELECT rp.id as retailer_product_id, p.id as product_id, p.name, p.brand,
                    p.pack_size, p.image_emoji, c.name as category,
                    rp.selling_price, rp.in_stock, rp.quantity
             FROM retailer_products rp
             JOIN products p ON p.id = rp.product_id
             JOIN categories c ON c.id = p.category_id
             WHERE rp.retailer_id = %s"""
    params = [rid]
    if q:
        sql += " AND LOWER(p.name) LIKE %s"
        params.append(f"%{q}%")
    if category:
        sql += " AND c.name = %s"
        params.append(category)
    sql += " ORDER BY c.name, p.name"
    cur.execute(sql, params)
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/categories", methods=["GET"])
def list_categories():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM categories ORDER BY name")
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/orders", methods=["POST"])
@auth_required(allowed_roles=["customer"])
def place_order():
    data = request.get_json(force=True)
    retailer_id = data.get("retailer_id")
    items = data.get("items", [])
    address = data.get("delivery_address", "")
    if not retailer_id or not items:
        return jsonify({"error": "retailer_id and items are required"}), 400

    conn = get_conn()
    cur = dict_cursor(conn)
    total = 0.0
    resolved = []
    for item in items:
        cur.execute(
            """SELECT rp.*, p.name as product_name FROM retailer_products rp
               JOIN products p ON p.id = rp.product_id
               WHERE rp.id = %s AND rp.retailer_id = %s""",
            (item["retailer_product_id"], retailer_id),
        )
        rp = row(cur)
        if not rp:
            conn.close()
            return jsonify({"error": "Product not found"}), 400
        if not rp["in_stock"] or rp["quantity"] < item["quantity"]:
            conn.close()
            return jsonify({"error": f"{rp['product_name']} insufficient stock"}), 409
        qty = item["quantity"]
        line_total = round(rp["selling_price"] * qty, 2)
        total += line_total
        resolved.append((rp["product_id"], rp["product_name"], qty, rp["selling_price"], line_total, rp["id"]))

    ts = now()
    cur.execute(
        """INSERT INTO orders (customer_id, retailer_id, status, payment_status, payment_mode,
           total_amount, delivery_address, created_at, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (g.user["user_id"], retailer_id, "placed", "paid", "mock_gateway", round(total, 2), address, ts, ts),
    )
    order_id = cur.fetchone()["id"]
    for product_id, pname, qty, price, line_total, rp_id in resolved:
        cur.execute(
            "INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (%s,%s,%s,%s,%s,%s)",
            (order_id, product_id, pname, qty, price, line_total),
        )
        cur.execute("UPDATE retailer_products SET quantity = quantity - %s WHERE id = %s", (qty, rp_id))
        cur.execute("UPDATE retailer_products SET in_stock = 0 WHERE id = %s AND quantity <= 0", (rp_id,))
    # Notify retailer
    cur.execute("SELECT id FROM users WHERE retailer_id = %s AND role='retailer'", (retailer_id,))
    retailer_user = row(cur)
    if retailer_user:
        cur.execute(
            "INSERT INTO notifications (user_id, message, created_at) VALUES (%s,%s,%s)",
            (retailer_user["id"], f"New order #{order_id} - ₹{round(total,2)}", ts),
        )
    conn.commit()
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    result = row(cur)
    conn.close()
    return jsonify(result), 201


@app.route("/api/orders/mine", methods=["GET"])
@auth_required(allowed_roles=["customer"])
def my_orders():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT o.*, r.store_name FROM orders o JOIN retailers r ON r.id = o.retailer_id
           WHERE o.customer_id = %s ORDER BY o.created_at DESC""",
        (g.user["user_id"],),
    )
    order_list = rows(cur)
    for o in order_list:
        cur.execute("SELECT * FROM order_items WHERE order_id = %s", (o["id"],))
        o["items"] = rows(cur)
    conn.close()
    return jsonify(order_list)


@app.route("/api/orders/<int:order_id>", methods=["GET"])
@auth_required()
def get_order(order_id):
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    o = row(cur)
    if not o:
        conn.close()
        return jsonify({"error": "Order not found"}), 404
    if g.user["role"] == "customer" and o["customer_id"] != g.user["user_id"]:
        conn.close()
        return jsonify({"error": "Access denied"}), 403
    cur.execute("SELECT * FROM order_items WHERE order_id = %s", (order_id,))
    o["items"] = rows(cur)
    conn.close()
    return jsonify(o)


# ── Retailer ──────────────────────────────────────────────────────────────────

@app.route("/api/retailer/dashboard", methods=["GET"])
@auth_required(allowed_roles=["retailer"])
def retailer_dashboard():
    rid = g.user["retailer_id"]
    today = datetime.date.today().isoformat()
    conn = get_conn()
    cur = dict_cursor(conn)
    def count(sql, p): cur.execute(sql, p); return cur.fetchone()["count"]
    stats = {
        "today_orders": count("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND created_at LIKE %s", (rid, f"{today}%")),
        "pending_orders": count("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status IN ('placed','accepted','packing')", (rid,)),
        "completed_orders": count("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status='delivered'", (rid,)),
        "rejected_orders": count("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status IN ('rejected','cancelled')", (rid,)),
    }
    cur.execute("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE retailer_id=%s AND payment_status='paid'", (rid,))
    stats["total_sales"] = float(cur.fetchone()["s"])
    conn.close()
    return jsonify(stats)


@app.route("/api/retailer/orders", methods=["GET"])
@auth_required(allowed_roles=["retailer"])
def retailer_orders():
    status_filter = request.args.get("status")
    conn = get_conn()
    cur = dict_cursor(conn)
    sql = """SELECT o.*, u.name as customer_name, u.phone as customer_phone
             FROM orders o JOIN users u ON u.id = o.customer_id
             WHERE o.retailer_id = %s"""
    params = [g.user["retailer_id"]]
    if status_filter:
        sql += " AND o.status = %s"
        params.append(status_filter)
    sql += " ORDER BY o.created_at DESC"
    cur.execute(sql, params)
    order_list = rows(cur)
    for o in order_list:
        cur.execute("SELECT * FROM order_items WHERE order_id = %s", (o["id"],))
        o["items"] = rows(cur)
    conn.close()
    return jsonify(order_list)


@app.route("/api/retailer/orders/<int:order_id>/status", methods=["PATCH"])
@auth_required(allowed_roles=["retailer"])
def update_order_status(order_id):
    new_status = (request.get_json(force=True) or {}).get("status")
    valid = ["accepted","rejected","packing","dispatched","delivered","cancelled"]
    if new_status not in valid:
        return jsonify({"error": f"status must be one of {valid}"}), 400
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    o = row(cur)
    if not o or o["retailer_id"] != g.user["retailer_id"]:
        conn.close()
        return jsonify({"error": "Order not found"}), 404
    cur.execute("UPDATE orders SET status=%s, updated_at=%s WHERE id=%s", (new_status, now(), order_id))
    msgs = {"accepted":"Your order was accepted","rejected":"Your order was rejected",
            "packing":"Your order is being packed","dispatched":"Your order is dispatched",
            "delivered":"Your order has been delivered","cancelled":"Your order was cancelled"}
    cur.execute("INSERT INTO notifications (user_id, message, created_at) VALUES (%s,%s,%s)",
                (o["customer_id"], f"Order #{order_id}: {msgs.get(new_status,'')}", now()))
    conn.commit()
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    result = row(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/retailer/catalog", methods=["GET"])
@auth_required(allowed_roles=["retailer"])
def retailer_own_catalog():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT rp.id as retailer_product_id, p.id as product_id, p.name, p.brand, p.pack_size,
                  p.sku_code, p.base_price, p.image_emoji, c.name as category,
                  rp.selling_price, rp.in_stock, rp.quantity
           FROM retailer_products rp
           JOIN products p ON p.id = rp.product_id
           JOIN categories c ON c.id = p.category_id
           WHERE rp.retailer_id = %s ORDER BY c.name, p.name""",
        (g.user["retailer_id"],),
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/retailer/catalog/<int:rp_id>", methods=["PATCH"])
@auth_required(allowed_roles=["retailer"])
def update_retailer_product(rp_id):
    data = request.get_json(force=True)
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM retailer_products WHERE id=%s AND retailer_id=%s", (rp_id, g.user["retailer_id"]))
    if not row(cur):
        conn.close()
        return jsonify({"error": "Product not found"}), 404
    fields, values = [], []
    if "selling_price" in data: fields.append("selling_price=%s"); values.append(float(data["selling_price"]))
    if "in_stock" in data: fields.append("in_stock=%s"); values.append(1 if data["in_stock"] else 0)
    if "quantity" in data: fields.append("quantity=%s"); values.append(int(data["quantity"]))
    if not fields:
        conn.close()
        return jsonify({"error": "No updatable fields"}), 400
    values.append(rp_id)
    cur.execute(f"UPDATE retailer_products SET {', '.join(fields)} WHERE id=%s", values)
    conn.commit()
    cur.execute("SELECT * FROM retailer_products WHERE id=%s", (rp_id,))
    result = row(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/retailer/reports/top-products", methods=["GET"])
@auth_required(allowed_roles=["retailer"])
def retailer_top_products():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.line_total) as total_sales
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.retailer_id = %s GROUP BY oi.product_name ORDER BY total_sales DESC LIMIT 10""",
        (g.user["retailer_id"],),
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.route("/api/admin/dashboard", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_dashboard():
    conn = get_conn()
    cur = dict_cursor(conn)
    def count(sql): cur.execute(sql); return cur.fetchone()["count"]
    stats = {
        "total_retailers": count("SELECT COUNT(*) as count FROM retailers"),
        "active_retailers": count("SELECT COUNT(*) as count FROM retailers WHERE status='active'"),
        "total_products": count("SELECT COUNT(*) as count FROM products"),
        "total_customers": count("SELECT COUNT(*) as count FROM users WHERE role='customer'"),
        "total_orders": count("SELECT COUNT(*) as count FROM orders"),
        "pending_orders": count("SELECT COUNT(*) as count FROM orders WHERE status IN ('placed','accepted','packing')"),
    }
    cur.execute("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE payment_status='paid'")
    stats["total_gmv"] = float(cur.fetchone()["s"])
    conn.close()
    return jsonify(stats)


@app.route("/api/admin/retailers", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_list_retailers():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT r.*,
                  (SELECT COUNT(*) FROM orders o WHERE o.retailer_id=r.id) as order_count,
                  (SELECT COALESCE(SUM(total_amount),0) FROM orders o WHERE o.retailer_id=r.id AND o.payment_status='paid') as total_sales
           FROM retailers r ORDER BY r.store_name"""
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/retailers", methods=["POST"])
@auth_required(allowed_roles=["admin"])
def admin_create_retailer():
    data = request.get_json(force=True)
    for f in ["store_name","owner_name","area","phone"]:
        if not data.get(f):
            return jsonify({"error": f"Required: {f}"}), 400
    conn = get_conn()
    cur = dict_cursor(conn)
    ts = now()
    cur.execute(
        "INSERT INTO retailers (store_name, owner_name, area, phone, status, created_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
        (data["store_name"], data["owner_name"], data["area"], data["phone"], "active", ts),
    )
    rid = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO users (name, phone, password_hash, role, retailer_id, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
        (data["owner_name"], data["phone"], hash_password("retailer123"), "retailer", rid, ts),
    )
    cur.execute("SELECT id, base_price FROM products")
    for p in rows(cur):
        cur.execute(
            "INSERT INTO retailer_products (retailer_id, product_id, selling_price, in_stock, quantity) VALUES (%s,%s,%s,%s,%s)",
            (rid, p["id"], round(p["base_price"] * 1.08, 2), 1, 25),
        )
    conn.commit()
    cur.execute("SELECT * FROM retailers WHERE id=%s", (rid,))
    result = row(cur)
    conn.close()
    return jsonify({**result, "login_phone": data["phone"], "login_password": "retailer123"}), 201


@app.route("/api/admin/retailers/<int:rid>/status", methods=["PATCH"])
@auth_required(allowed_roles=["admin"])
def admin_toggle_retailer(rid):
    new_status = (request.get_json(force=True) or {}).get("status")
    if new_status not in ("active","inactive"):
        return jsonify({"error": "status must be active or inactive"}), 400
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("UPDATE retailers SET status=%s WHERE id=%s", (new_status, rid))
    conn.commit()
    cur.execute("SELECT * FROM retailers WHERE id=%s", (rid,))
    result = row(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/products", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_list_products():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        "SELECT p.*, c.name as category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY c.name, p.name"
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/products", methods=["POST"])
@auth_required(allowed_roles=["admin"])
def admin_create_product():
    data = request.get_json(force=True)
    for f in ["name","category_id","base_price"]:
        if data.get(f) is None:
            return jsonify({"error": f"Required: {f}"}), 400
    import time
    sku = data.get("sku_code") or f"SKU{int(time.time())}"
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """INSERT INTO products (sku_code, name, brand, category_id, pack_size, base_price, gst_rate, image_emoji, created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (sku, data["name"], data.get("brand",""), data["category_id"], data.get("pack_size",""),
         float(data["base_price"]), float(data.get("gst_rate",5.0)), data.get("image_emoji","🛒"), now()),
    )
    pid = cur.fetchone()["id"]
    cur.execute("SELECT id FROM retailers WHERE status='active'")
    for r in rows(cur):
        cur.execute(
            "INSERT INTO retailer_products (retailer_id, product_id, selling_price, in_stock, quantity) VALUES (%s,%s,%s,%s,%s)",
            (r["id"], pid, round(float(data["base_price"])*1.08,2), 1, 20),
        )
    conn.commit()
    cur.execute("SELECT * FROM products WHERE id=%s", (pid,))
    result = row(cur)
    conn.close()
    return jsonify(result), 201


@app.route("/api/admin/orders", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_list_orders():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT o.*, r.store_name, u.name as customer_name
           FROM orders o JOIN retailers r ON r.id=o.retailer_id JOIN users u ON u.id=o.customer_id
           ORDER BY o.created_at DESC LIMIT 100"""
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/analytics/retailer-performance", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_retailer_performance():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT r.store_name, r.area,
                  COUNT(o.id) as order_count,
                  COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN o.total_amount ELSE 0 END),0) as total_sales,
                  COALESCE(SUM(CASE WHEN o.status IN ('rejected','cancelled') THEN 1 ELSE 0 END),0) as cancelled_count
           FROM retailers r LEFT JOIN orders o ON o.retailer_id=r.id
           GROUP BY r.id, r.store_name, r.area ORDER BY total_sales DESC"""
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/analytics/top-products", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_top_products():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        """SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.line_total) as total_sales
           FROM order_items oi GROUP BY oi.product_name ORDER BY total_qty DESC LIMIT 10"""
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/admin/analytics/order-status-breakdown", methods=["GET"])
@auth_required(allowed_roles=["admin"])
def admin_order_status_breakdown():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("SELECT status, COUNT(*) as count FROM orders GROUP BY status")
    result = rows(cur)
    conn.close()
    return jsonify(result)


# ── Notifications ─────────────────────────────────────────────────────────────

@app.route("/api/notifications", methods=["GET"])
@auth_required()
def get_notifications():
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute(
        "SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 20",
        (g.user["user_id"],),
    )
    result = rows(cur)
    conn.close()
    return jsonify(result)


@app.route("/api/notifications/<int:nid>/read", methods=["PATCH"])
@auth_required()
def mark_read(nid):
    conn = get_conn()
    cur = dict_cursor(conn)
    cur.execute("UPDATE notifications SET is_read=1 WHERE id=%s AND user_id=%s", (nid, g.user["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "freshline-api"})


# Vercel entry point
from flask import Flask as _F
handler = app
