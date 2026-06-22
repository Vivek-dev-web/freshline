"""
Database layer — PostgreSQL (Neon) for production deployment.
Uses psycopg2 with connection pooling via DATABASE_URL env var.
Schema is identical to the SQLite demo; only the connection and
a few SQL idioms differ (SERIAL vs AUTOINCREMENT, %s vs ?).
"""
import os
import datetime
import hashlib
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def now():
    return datetime.datetime.utcnow().isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS retailers (
    id SERIAL PRIMARY KEY,
    store_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    area TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('customer','retailer','admin')),
    retailer_id INTEGER REFERENCES retailers(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    pack_size TEXT,
    base_price REAL NOT NULL,
    gst_rate REAL NOT NULL DEFAULT 5.0,
    image_emoji TEXT DEFAULT '🛒',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retailer_products (
    id SERIAL PRIMARY KEY,
    retailer_id INTEGER NOT NULL REFERENCES retailers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    selling_price REAL NOT NULL,
    in_stock INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(retailer_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    retailer_id INTEGER NOT NULL REFERENCES retailers(id),
    status TEXT NOT NULL DEFAULT 'placed'
        CHECK(status IN ('placed','accepted','rejected','packing','dispatched','delivered','cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK(payment_status IN ('pending','paid','failed','refunded')),
    payment_mode TEXT NOT NULL DEFAULT 'mock_gateway',
    total_amount REAL NOT NULL,
    delivery_address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
"""


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    # Run schema
    cur.execute(SCHEMA)
    # Check if already seeded
    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count == 0:
        _seed(conn, cur)
    conn.commit()
    conn.close()


def _seed(conn, cur):
    ts = now()

    # Categories
    categories = ["Staples", "Dairy & Bakery", "Snacks", "Beverages", "Personal Care", "Vegetables & Fruits"]
    cat_ids = {}
    for c in categories:
        cur.execute("INSERT INTO categories (name) VALUES (%s) RETURNING id", (c,))
        cat_ids[c] = cur.fetchone()[0]

    # Retailers
    retailers = [
        ("Sharma General Store", "Ramesh Sharma", "Andheri West, Mumbai", "9820011111"),
        ("Quick Mart Bandra", "Priya Mehta", "Bandra East, Mumbai", "9820022222"),
        ("Daily Needs Powai", "Suresh Iyer", "Powai, Mumbai", "9820033333"),
    ]
    retailer_ids = []
    for store_name, owner, area, phone in retailers:
        cur.execute(
            "INSERT INTO retailers (store_name, owner_name, area, phone, status, created_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
            (store_name, owner, area, phone, "active", ts),
        )
        retailer_ids.append(cur.fetchone()[0])

    # Products
    products = [
        ("Toor Dal", "Tata Sampann", "Staples", "1 kg", 145.0, 5.0, "🫘"),
        ("Basmati Rice", "India Gate", "Staples", "5 kg", 520.0, 5.0, "🍚"),
        ("Sunflower Oil", "Fortune", "Staples", "1 L", 165.0, 5.0, "🛢️"),
        ("Whole Wheat Atta", "Aashirvaad", "Staples", "5 kg", 245.0, 5.0, "🌾"),
        ("Toned Milk", "Amul", "Dairy & Bakery", "500 ml", 27.0, 0.0, "🥛"),
        ("Bread", "Modern", "Dairy & Bakery", "400 g", 45.0, 5.0, "🍞"),
        ("Paneer", "Amul", "Dairy & Bakery", "200 g", 90.0, 5.0, "🧀"),
        ("Butter", "Amul", "Dairy & Bakery", "100 g", 58.0, 12.0, "🧈"),
        ("Potato Chips", "Lay's", "Snacks", "90 g", 40.0, 12.0, "🥔"),
        ("Biscuits", "Parle-G", "Snacks", "200 g", 25.0, 18.0, "🍪"),
        ("Namkeen Mix", "Haldiram's", "Snacks", "200 g", 55.0, 12.0, "🥜"),
        ("Cola Soft Drink", "Coca-Cola", "Beverages", "750 ml", 40.0, 28.0, "🥤"),
        ("Tea Powder", "Tata Tea", "Beverages", "250 g", 130.0, 5.0, "🍵"),
        ("Instant Coffee", "Nescafe", "Beverages", "50 g", 175.0, 18.0, "☕"),
        ("Toothpaste", "Colgate", "Personal Care", "150 g", 95.0, 18.0, "🪥"),
        ("Soap Bar", "Lux", "Personal Care", "100 g", 42.0, 18.0, "🧼"),
        ("Shampoo", "Head & Shoulders", "Personal Care", "180 ml", 165.0, 18.0, "🧴"),
        ("Onion", "Farm Fresh", "Vegetables & Fruits", "1 kg", 35.0, 0.0, "🧅"),
        ("Tomato", "Farm Fresh", "Vegetables & Fruits", "1 kg", 40.0, 0.0, "🍅"),
        ("Banana", "Farm Fresh", "Vegetables & Fruits", "1 dozen", 60.0, 0.0, "🍌"),
    ]
    product_ids = []
    import random
    random.seed(42)
    for i, (name, brand, cat, pack, price, gst, emoji) in enumerate(products):
        sku = f"SKU{1000 + i}"
        cur.execute(
            """INSERT INTO products (sku_code, name, brand, category_id, pack_size, base_price, gst_rate, image_emoji, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (sku, name, brand, cat_ids[cat], pack, price, gst, emoji, ts),
        )
        product_ids.append(cur.fetchone()[0])

    # Retailer products
    for r_id in retailer_ids:
        for p_id, (_, _, _, _, price, _, _) in zip(product_ids, products):
            markup = random.uniform(1.03, 1.12)
            selling_price = round(price * markup, 2)
            in_stock = 1 if random.random() > 0.08 else 0
            qty = random.randint(5, 80) if in_stock else 0
            cur.execute(
                "INSERT INTO retailer_products (retailer_id, product_id, selling_price, in_stock, quantity) VALUES (%s,%s,%s,%s,%s)",
                (r_id, p_id, selling_price, in_stock, qty),
            )

    # Users
    cur.execute(
        "INSERT INTO users (name, phone, password_hash, role, retailer_id, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
        ("Platform Admin", "9999999999", hash_password("admin123"), "admin", None, ts),
    )
    for idx, r_id in enumerate(retailer_ids):
        phone = retailers[idx][3]
        cur.execute(
            "INSERT INTO users (name, phone, password_hash, role, retailer_id, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
            (retailers[idx][1], phone, hash_password("retailer123"), "retailer", r_id, ts),
        )
    customer_ids = []
    for name, phone in [("Anita Verma", "9000000001"), ("Rahul Kapoor", "9000000002")]:
        cur.execute(
            "INSERT INTO users (name, phone, password_hash, role, retailer_id, created_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
            (name, phone, hash_password("customer123"), "customer", None, ts),
        )
        customer_ids.append(cur.fetchone()[0])

    # Sample orders
    sample_orders = [
        (customer_ids[0], retailer_ids[0], "delivered", "paid", [(product_ids[0], 2), (product_ids[4], 3)]),
        (customer_ids[0], retailer_ids[0], "placed", "paid", [(product_ids[8], 1), (product_ids[11], 2)]),
        (customer_ids[1], retailer_ids[1], "accepted", "paid", [(product_ids[1], 1), (product_ids[6], 1)]),
        (customer_ids[1], retailer_ids[2], "dispatched", "paid", [(product_ids[17], 2), (product_ids[18], 1)]),
    ]
    for cust_id, ret_id, status, pay_status, items in sample_orders:
        total = 0.0
        line_items = []
        for p_id, qty in items:
            cur.execute("SELECT selling_price FROM retailer_products WHERE retailer_id=%s AND product_id=%s", (ret_id, p_id))
            price = cur.fetchone()[0]
            cur.execute("SELECT name FROM products WHERE id=%s", (p_id,))
            pname = cur.fetchone()[0]
            line_total = round(price * qty, 2)
            total += line_total
            line_items.append((p_id, pname, qty, price, line_total))
        cur.execute(
            "INSERT INTO orders (customer_id, retailer_id, status, payment_status, payment_mode, total_amount, delivery_address, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (cust_id, ret_id, status, pay_status, "mock_gateway", round(total, 2), "Demo Address, Mumbai", ts, ts),
        )
        order_id = cur.fetchone()[0]
        for p_id, pname, qty, price, line_total in line_items:
            cur.execute(
                "INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (%s,%s,%s,%s,%s,%s)",
                (order_id, p_id, pname, qty, price, line_total),
            )
