"""
FreshLine API - single-file Vercel Python serverless function.
database.py merged in here to avoid import path issues on Vercel.
"""
import os, sys, datetime, hashlib, time
from functools import wraps

# ── Dependencies ──────────────────────────────────────────────────────────────
import jwt
from flask import Flask, request, jsonify, g
import pg8000
import pg8000.native

# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL")

def _parse_url(url):
    # Parse postgresql://user:pass@host/dbname?params into pg8000 kwargs
    import urllib.parse
    r = urllib.parse.urlparse(url)
    kwargs = {
        "host": r.hostname,
        "port": r.port or 5432,
        "user": r.username,
        "password": r.password,
        "database": r.path.lstrip("/"),
        "ssl_context": True,  # Neon requires SSL
    }
    return kwargs

class DictConn:
    """Wraps pg8000 to give psycopg2-compatible dict-row interface.
    Acts as both connection AND cursor so the same object can be passed
    as both conn and cur throughout the codebase."""
    def __init__(self, conn):
        self._conn = conn
        self._cur = conn.cursor()
        self._cols = []

    def cursor(self):
        """Returns self so dc(conn) = conn works seamlessly."""
        return self

    def execute(self, sql, params=None):
        if params:
            self._cur.execute(sql, list(params))
        else:
            self._cur.execute(sql)
        self._cols = [d[0] for d in (self._cur.description or [])]

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None: return None
        return dict(zip(self._cols, row))

    def fetchall(self):
        return [dict(zip(self._cols, r)) for r in self._cur.fetchall()]

    def commit(self): self._conn.commit()
    def rollback(self): self._conn.rollback()
    def close(self): self._conn.close()

_conn_kwargs = None

def get_conn():
    global _conn_kwargs
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL env var not set in Vercel Project Settings → Environment Variables")
    if _conn_kwargs is None:
        _conn_kwargs = _parse_url(DATABASE_URL)
    raw = pg8000.connect(**_conn_kwargs)
    return DictConn(raw)

def dc(conn):
    return conn  # DictConn already acts as both conn and cursor manager

def hp(raw):
    return hashlib.sha256(raw.encode()).hexdigest()

def now():
    return datetime.datetime.utcnow().isoformat()

SCHEMA = """
CREATE TABLE IF NOT EXISTS retailers (
    id SERIAL PRIMARY KEY, store_name TEXT NOT NULL, owner_name TEXT NOT NULL,
    area TEXT NOT NULL, phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','retailer','admin')),
    retailer_id INTEGER REFERENCES retailers(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY, sku_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, brand TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id), pack_size TEXT,
    base_price REAL NOT NULL, gst_rate REAL NOT NULL DEFAULT 5.0,
    image_emoji TEXT DEFAULT '🛒', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS retailer_products (
    id SERIAL PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES retailers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    selling_price REAL NOT NULL, in_stock INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 0, UNIQUE(retailer_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES users(id),
    retailer_id INTEGER NOT NULL REFERENCES retailers(id),
    status TEXT NOT NULL DEFAULT 'placed'
        CHECK(status IN ('placed','accepted','rejected','packing','dispatched','delivered','cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK(payment_status IN ('pending','paid','failed','refunded')),
    payment_mode TEXT NOT NULL DEFAULT 'mock_gateway',
    total_amount REAL NOT NULL, delivery_address TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL, quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL, line_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
"""

def init_db():
    conn = get_conn()
    conn.execute(SCHEMA)
    conn.execute("SELECT COUNT(*) FROM users")
    r = conn.fetchone()
    if r is None or list(r.values())[0] == 0:
        _seed(conn)
    conn.commit()
    conn.close()

def _seed(conn):
    cur = conn  # DictConn acts as cursor
    ts = now()
    import random; random.seed(42)
    cats = ["Staples","Dairy & Bakery","Snacks","Beverages","Personal Care","Vegetables & Fruits"]
    cat_ids = {}
    for c in cats:
        cur.execute("INSERT INTO categories (name) VALUES (%s) RETURNING id", (c,))
        cat_ids[c] = cur.fetchone()[0]
    rets = [("Sharma General Store","Ramesh Sharma","Andheri West, Mumbai","9820011111"),
            ("Quick Mart Bandra","Priya Mehta","Bandra East, Mumbai","9820022222"),
            ("Daily Needs Powai","Suresh Iyer","Powai, Mumbai","9820033333")]
    rids = []
    for sn,on,ar,ph in rets:
        cur.execute("INSERT INTO retailers (store_name,owner_name,area,phone,status,created_at) VALUES (%s,%s,%s,%s,'active',%s) RETURNING id",(sn,on,ar,ph,ts))
        rids.append(cur.fetchone()[0])
    prods = [
        ("Toor Dal","Tata Sampann","Staples","1 kg",145.0,5.0,"🫘"),
        ("Basmati Rice","India Gate","Staples","5 kg",520.0,5.0,"🍚"),
        ("Sunflower Oil","Fortune","Staples","1 L",165.0,5.0,"🛢️"),
        ("Whole Wheat Atta","Aashirvaad","Staples","5 kg",245.0,5.0,"🌾"),
        ("Toned Milk","Amul","Dairy & Bakery","500 ml",27.0,0.0,"🥛"),
        ("Bread","Modern","Dairy & Bakery","400 g",45.0,5.0,"🍞"),
        ("Paneer","Amul","Dairy & Bakery","200 g",90.0,5.0,"🧀"),
        ("Butter","Amul","Dairy & Bakery","100 g",58.0,12.0,"🧈"),
        ("Potato Chips","Lay's","Snacks","90 g",40.0,12.0,"🥔"),
        ("Biscuits","Parle-G","Snacks","200 g",25.0,18.0,"🍪"),
        ("Namkeen Mix","Haldiram's","Snacks","200 g",55.0,12.0,"🥜"),
        ("Cola Soft Drink","Coca-Cola","Beverages","750 ml",40.0,28.0,"🥤"),
        ("Tea Powder","Tata Tea","Beverages","250 g",130.0,5.0,"🍵"),
        ("Instant Coffee","Nescafe","Beverages","50 g",175.0,18.0,"☕"),
        ("Toothpaste","Colgate","Personal Care","150 g",95.0,18.0,"🪥"),
        ("Soap Bar","Lux","Personal Care","100 g",42.0,18.0,"🧼"),
        ("Shampoo","Head & Shoulders","Personal Care","180 ml",165.0,18.0,"🧴"),
        ("Onion","Farm Fresh","Vegetables & Fruits","1 kg",35.0,0.0,"🧅"),
        ("Tomato","Farm Fresh","Vegetables & Fruits","1 kg",40.0,0.0,"🍅"),
        ("Banana","Farm Fresh","Vegetables & Fruits","1 dozen",60.0,0.0,"🍌"),
    ]
    pids = []
    for i,(name,brand,cat,pack,price,gst,emoji) in enumerate(prods):
        cur.execute("INSERT INTO products (sku_code,name,brand,category_id,pack_size,base_price,gst_rate,image_emoji,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (f"SKU{1000+i}",name,brand,cat_ids[cat],pack,price,gst,emoji,ts))
        pids.append(cur.fetchone()[0])
    for rid in rids:
        for pid,(_, _,_,_,price,_,_) in zip(pids,prods):
            mk=random.uniform(1.03,1.12); ins=1 if random.random()>0.08 else 0
            cur.execute("INSERT INTO retailer_products (retailer_id,product_id,selling_price,in_stock,quantity) VALUES (%s,%s,%s,%s,%s)",
                (rid,pid,round(price*mk,2),ins,random.randint(5,80) if ins else 0))
    cur.execute("INSERT INTO users (name,phone,password_hash,role,retailer_id,created_at) VALUES (%s,%s,%s,'admin',NULL,%s)",
        ("Platform Admin","9999999999",hp("admin123"),ts))
    for i,(sn,on,ar,ph) in enumerate(rets):
        cur.execute("INSERT INTO users (name,phone,password_hash,role,retailer_id,created_at) VALUES (%s,%s,%s,'retailer',%s,%s)",
            (on,ph,hp("retailer123"),rids[i],ts))
    cids=[]
    for name,phone in [("Anita Verma","9000000001"),("Rahul Kapoor","9000000002")]:
        cur.execute("INSERT INTO users (name,phone,password_hash,role,retailer_id,created_at) VALUES (%s,%s,%s,'customer',NULL,%s) RETURNING id",
            (name,phone,hp("customer123"),ts))
        cids.append(cur.fetchone()[0])
    for cid,rid,st,ps,items in [
        (cids[0],rids[0],"delivered","paid",[(pids[0],2),(pids[4],3)]),
        (cids[0],rids[0],"placed","paid",[(pids[8],1),(pids[11],2)]),
        (cids[1],rids[1],"accepted","paid",[(pids[1],1),(pids[6],1)]),
        (cids[1],rids[2],"dispatched","paid",[(pids[17],2),(pids[18],1)]),
    ]:
        total=0; lines=[]
        for pid,qty in items:
            cur.execute("SELECT selling_price FROM retailer_products WHERE retailer_id=%s AND product_id=%s",(rid,pid))
            pr=cur.fetchone()[0]
            cur.execute("SELECT name FROM products WHERE id=%s",(pid,))
            pn=cur.fetchone()[0]
            lt=round(pr*qty,2); total+=lt; lines.append((pid,pn,qty,pr,lt))
        cur.execute("INSERT INTO orders (customer_id,retailer_id,status,payment_status,payment_mode,total_amount,delivery_address,created_at,updated_at) VALUES (%s,%s,%s,%s,'mock_gateway',%s,'Demo Address',%s,%s) RETURNING id",
            (cid,rid,st,ps,round(total,2),ts,ts))
        oid=cur.fetchone()[0]
        for pid,pn,qty,pr,lt in lines:
            cur.execute("INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price,line_total) VALUES (%s,%s,%s,%s,%s,%s)",
                (oid,pid,pn,qty,pr,lt))

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
SECRET_KEY = os.environ.get("JWT_SECRET", "freshline-default-secret")
_db_initialized = False

def ensure_db():
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True

def rows(cur): return [dict(r) for r in cur.fetchall()]
def row(cur): r=cur.fetchone(); return dict(r) if r else None

@app.errorhandler(Exception)
def handle_exc(e):
    import traceback
    tb = traceback.format_exc()
    print(tb)  # shows in Vercel function logs
    return jsonify({"error": str(e), "type": type(e).__name__}), 500

@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    return response

@app.route("/api/<path:p>", methods=["OPTIONS"])
@app.route("/api/", methods=["OPTIONS"])
def options(p=""):
    return "", 200

@app.before_request
def before():
    if request.method == "OPTIONS" or request.path == "/api/health":
        return
    ensure_db()

# ── Health ─────────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    if not DATABASE_URL:
        return jsonify({"status":"error","error":"DATABASE_URL not set in Vercel env vars"}), 500
    try:
        conn=get_conn(); cur=dc(conn)
        cur.execute("SELECT COUNT(*) as c FROM users")
        n=cur.fetchone()["c"]; conn.close()
        return jsonify({"status":"ok","db_users":n})
    except Exception as e:
        return jsonify({"status":"error","error":str(e)}), 500

def make_token(user):
    payload={"user_id":user["id"],"role":user["role"],"retailer_id":user["retailer_id"],"name":user["name"],
             "exp":datetime.datetime.utcnow()+datetime.timedelta(hours=12)}
    return jwt.encode(payload,SECRET_KEY,algorithm="HS256")

def auth_required(roles=None):
    def dec(f):
        @wraps(f)
        def wrapper(*a,**kw):
            auth=request.headers.get("Authorization","")
            if not auth.startswith("Bearer "):
                return jsonify({"error":"Missing token"}),401
            try: payload=jwt.decode(auth.split(" ",1)[1],SECRET_KEY,algorithms=["HS256"])
            except jwt.ExpiredSignatureError: return jsonify({"error":"Session expired"}),401
            except: return jsonify({"error":"Invalid token"}),401
            if roles and payload["role"] not in roles:
                return jsonify({"error":"Access denied"}),403
            g.user=payload
            return f(*a,**kw)
        return wrapper
    return dec

# ── Auth ───────────────────────────────────────────────────────────────────────
@app.route("/api/auth/login",methods=["POST"])
def login():
    data=request.get_json(force=True)
    phone=(data.get("phone") or "").strip(); pwd=data.get("password") or ""
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM users WHERE phone=%s",(phone,))
    user=row(cur); conn.close()
    if not user or user["password_hash"]!=hp(pwd):
        return jsonify({"error":"Invalid phone or password"}),401
    return jsonify({"token":make_token(user),"user":{"id":user["id"],"name":user["name"],"phone":user["phone"],"role":user["role"],"retailer_id":user["retailer_id"]}})

@app.route("/api/auth/register",methods=["POST"])
def register():
    data=request.get_json(force=True)
    name=(data.get("name") or "").strip(); phone=(data.get("phone") or "").strip(); pwd=data.get("password") or ""
    if not name or not phone or not pwd:
        return jsonify({"error":"Name, phone and password required"}),400
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT id FROM users WHERE phone=%s",(phone,))
    if cur.fetchone(): conn.close(); return jsonify({"error":"Phone already registered"}),409
    cur.execute("INSERT INTO users (name,phone,password_hash,role,retailer_id,created_at) VALUES (%s,%s,%s,'customer',NULL,%s) RETURNING id",
        (name,phone,hp(pwd),now()))
    uid=cur.fetchone()["id"]; conn.commit()
    cur.execute("SELECT * FROM users WHERE id=%s",(uid,)); user=row(cur); conn.close()
    return jsonify({"token":make_token(user),"user":{"id":user["id"],"name":user["name"],"phone":user["phone"],"role":user["role"],"retailer_id":user["retailer_id"]}}),201

@app.route("/api/auth/me")
@auth_required()
def me(): return jsonify(g.user)

# ── Customer ───────────────────────────────────────────────────────────────────
@app.route("/api/retailers")
def list_retailers():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM retailers WHERE status='active' ORDER BY store_name")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/retailers/<int:rid>/catalog")
def catalog(rid):
    q=request.args.get("q","").strip().lower(); cat=request.args.get("category","").strip()
    conn=get_conn(); cur=dc(conn)
    sql="""SELECT rp.id as retailer_product_id,p.id as product_id,p.name,p.brand,p.pack_size,
           p.image_emoji,c.name as category,rp.selling_price,rp.in_stock,rp.quantity
           FROM retailer_products rp JOIN products p ON p.id=rp.product_id
           JOIN categories c ON c.id=p.category_id WHERE rp.retailer_id=%s"""
    params=[rid]
    if q: sql+=" AND LOWER(p.name) LIKE %s"; params.append(f"%{q}%")
    if cat: sql+=" AND c.name=%s"; params.append(cat)
    sql+=" ORDER BY c.name,p.name"
    cur.execute(sql,params); r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/categories")
def categories():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM categories ORDER BY name")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/orders",methods=["POST"])
@auth_required(roles=["customer"])
def place_order():
    data=request.get_json(force=True)
    rid=data.get("retailer_id"); items=data.get("items",[]); addr=data.get("delivery_address","")
    if not rid or not items: return jsonify({"error":"retailer_id and items required"}),400
    conn=get_conn(); cur=dc(conn); total=0.0; resolved=[]
    for item in items:
        cur.execute("SELECT rp.*,p.name as product_name FROM retailer_products rp JOIN products p ON p.id=rp.product_id WHERE rp.id=%s AND rp.retailer_id=%s",
            (item["retailer_product_id"],rid))
        rp=row(cur)
        if not rp: conn.close(); return jsonify({"error":"Product not found"}),400
        if not rp["in_stock"] or rp["quantity"]<item["quantity"]:
            conn.close(); return jsonify({"error":f"{rp['product_name']} insufficient stock"}),409
        qty=item["quantity"]; lt=round(rp["selling_price"]*qty,2); total+=lt
        resolved.append((rp["product_id"],rp["product_name"],qty,rp["selling_price"],lt,rp["id"]))
    ts=now()
    cur.execute("INSERT INTO orders (customer_id,retailer_id,status,payment_status,payment_mode,total_amount,delivery_address,created_at,updated_at) VALUES (%s,%s,'placed','paid','mock_gateway',%s,%s,%s,%s) RETURNING id",
        (g.user["user_id"],rid,round(total,2),addr,ts,ts))
    oid=cur.fetchone()["id"]
    for pid,pn,qty,pr,lt,rpid in resolved:
        cur.execute("INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price,line_total) VALUES (%s,%s,%s,%s,%s,%s)",(oid,pid,pn,qty,pr,lt))
        cur.execute("UPDATE retailer_products SET quantity=quantity-%s WHERE id=%s",(qty,rpid))
        cur.execute("UPDATE retailer_products SET in_stock=0 WHERE id=%s AND quantity<=0",(rpid,))
    cur.execute("SELECT id FROM users WHERE retailer_id=%s AND role='retailer'",(rid,))
    ru=row(cur)
    if ru: cur.execute("INSERT INTO notifications (user_id,message,created_at) VALUES (%s,%s,%s)",(ru["id"],f"New order #{oid} - ₹{round(total,2)}",ts))
    conn.commit()
    cur.execute("SELECT * FROM orders WHERE id=%s",(oid,)); r=row(cur); conn.close()
    return jsonify(r),201

@app.route("/api/orders/mine")
@auth_required(roles=["customer"])
def my_orders():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT o.*,r.store_name FROM orders o JOIN retailers r ON r.id=o.retailer_id WHERE o.customer_id=%s ORDER BY o.created_at DESC",(g.user["user_id"],))
    ol=rows(cur)
    for o in ol:
        cur.execute("SELECT * FROM order_items WHERE order_id=%s",(o["id"],)); o["items"]=rows(cur)
    conn.close(); return jsonify(ol)

@app.route("/api/orders/<int:oid>")
@auth_required()
def get_order(oid):
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM orders WHERE id=%s",(oid,)); o=row(cur)
    if not o: conn.close(); return jsonify({"error":"Not found"}),404
    if g.user["role"]=="customer" and o["customer_id"]!=g.user["user_id"]:
        conn.close(); return jsonify({"error":"Access denied"}),403
    cur.execute("SELECT * FROM order_items WHERE order_id=%s",(oid,)); o["items"]=rows(cur)
    conn.close(); return jsonify(o)

# ── Retailer ───────────────────────────────────────────────────────────────────
@app.route("/api/retailer/dashboard")
@auth_required(roles=["retailer"])
def retailer_dashboard():
    rid=g.user["retailer_id"]; today=datetime.date.today().isoformat()
    conn=get_conn(); cur=dc(conn)
    def cnt(sql,p): cur.execute(sql,p); return cur.fetchone()["count"]
    s={"today_orders":cnt("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND created_at LIKE %s",(rid,f"{today}%")),
       "pending_orders":cnt("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status IN ('placed','accepted','packing')",(rid,)),
       "completed_orders":cnt("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status='delivered'",(rid,)),
       "rejected_orders":cnt("SELECT COUNT(*) as count FROM orders WHERE retailer_id=%s AND status IN ('rejected','cancelled')",(rid,))}
    cur.execute("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE retailer_id=%s AND payment_status='paid'",(rid,))
    s["total_sales"]=float(cur.fetchone()["s"]); conn.close(); return jsonify(s)

@app.route("/api/retailer/orders")
@auth_required(roles=["retailer"])
def retailer_orders():
    sf=request.args.get("status"); conn=get_conn(); cur=dc(conn)
    sql="SELECT o.*,u.name as customer_name,u.phone as customer_phone FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.retailer_id=%s"
    params=[g.user["retailer_id"]]
    if sf: sql+=" AND o.status=%s"; params.append(sf)
    sql+=" ORDER BY o.created_at DESC"
    cur.execute(sql,params); ol=rows(cur)
    for o in ol:
        cur.execute("SELECT * FROM order_items WHERE order_id=%s",(o["id"],)); o["items"]=rows(cur)
    conn.close(); return jsonify(ol)

@app.route("/api/retailer/orders/<int:oid>/status",methods=["PATCH"])
@auth_required(roles=["retailer"])
def update_order_status(oid):
    ns=(request.get_json(force=True) or {}).get("status")
    if ns not in ["accepted","rejected","packing","dispatched","delivered","cancelled"]:
        return jsonify({"error":"Invalid status"}),400
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM orders WHERE id=%s",(oid,)); o=row(cur)
    if not o or o["retailer_id"]!=g.user["retailer_id"]: conn.close(); return jsonify({"error":"Not found"}),404
    cur.execute("UPDATE orders SET status=%s,updated_at=%s WHERE id=%s",(ns,now(),oid))
    msgs={"accepted":"accepted","rejected":"rejected","packing":"being packed","dispatched":"dispatched","delivered":"delivered","cancelled":"cancelled"}
    cur.execute("INSERT INTO notifications (user_id,message,created_at) VALUES (%s,%s,%s)",(o["customer_id"],f"Order #{oid} {msgs.get(ns,'')}",now()))
    conn.commit(); cur.execute("SELECT * FROM orders WHERE id=%s",(oid,)); r=row(cur); conn.close(); return jsonify(r)

@app.route("/api/retailer/catalog")
@auth_required(roles=["retailer"])
def retailer_catalog():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT rp.id as retailer_product_id,p.id as product_id,p.name,p.brand,p.pack_size,p.sku_code,p.base_price,p.image_emoji,c.name as category,rp.selling_price,rp.in_stock,rp.quantity FROM retailer_products rp JOIN products p ON p.id=rp.product_id JOIN categories c ON c.id=p.category_id WHERE rp.retailer_id=%s ORDER BY c.name,p.name",(g.user["retailer_id"],))
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/retailer/catalog/<int:rpid>",methods=["PATCH"])
@auth_required(roles=["retailer"])
def update_retailer_product(rpid):
    data=request.get_json(force=True); conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM retailer_products WHERE id=%s AND retailer_id=%s",(rpid,g.user["retailer_id"]))
    if not row(cur): conn.close(); return jsonify({"error":"Not found"}),404
    fields,values=[],[]
    if "selling_price" in data: fields.append("selling_price=%s"); values.append(float(data["selling_price"]))
    if "in_stock" in data: fields.append("in_stock=%s"); values.append(1 if data["in_stock"] else 0)
    if "quantity" in data: fields.append("quantity=%s"); values.append(int(data["quantity"]))
    if not fields: conn.close(); return jsonify({"error":"No fields"}),400
    values.append(rpid); cur.execute(f"UPDATE retailer_products SET {', '.join(fields)} WHERE id=%s",values)
    conn.commit(); cur.execute("SELECT * FROM retailer_products WHERE id=%s",(rpid,)); r=row(cur); conn.close(); return jsonify(r)

@app.route("/api/retailer/reports/top-products")
@auth_required(roles=["retailer"])
def retailer_top():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT oi.product_name,SUM(oi.quantity) as total_qty,SUM(oi.line_total) as total_sales FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.retailer_id=%s GROUP BY oi.product_name ORDER BY total_sales DESC LIMIT 10",(g.user["retailer_id"],))
    r=rows(cur); conn.close(); return jsonify(r)

# ── Admin ──────────────────────────────────────────────────────────────────────
@app.route("/api/admin/dashboard")
@auth_required(roles=["admin"])
def admin_dashboard():
    conn=get_conn(); cur=dc(conn)
    def cnt(sql): cur.execute(sql); return cur.fetchone()["count"]
    s={"total_retailers":cnt("SELECT COUNT(*) as count FROM retailers"),
       "active_retailers":cnt("SELECT COUNT(*) as count FROM retailers WHERE status='active'"),
       "total_products":cnt("SELECT COUNT(*) as count FROM products"),
       "total_customers":cnt("SELECT COUNT(*) as count FROM users WHERE role='customer'"),
       "total_orders":cnt("SELECT COUNT(*) as count FROM orders"),
       "pending_orders":cnt("SELECT COUNT(*) as count FROM orders WHERE status IN ('placed','accepted','packing')")}
    cur.execute("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE payment_status='paid'")
    s["total_gmv"]=float(cur.fetchone()["s"]); conn.close(); return jsonify(s)

@app.route("/api/admin/retailers",methods=["GET"])
@auth_required(roles=["admin"])
def admin_retailers():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT r.*,(SELECT COUNT(*) FROM orders o WHERE o.retailer_id=r.id) as order_count,(SELECT COALESCE(SUM(total_amount),0) FROM orders o WHERE o.retailer_id=r.id AND o.payment_status='paid') as total_sales FROM retailers r ORDER BY r.store_name")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/retailers",methods=["POST"])
@auth_required(roles=["admin"])
def admin_create_retailer():
    data=request.get_json(force=True)
    for f in ["store_name","owner_name","area","phone"]:
        if not data.get(f): return jsonify({"error":f"Required: {f}"}),400
    conn=get_conn(); cur=dc(conn); ts=now()
    cur.execute("INSERT INTO retailers (store_name,owner_name,area,phone,status,created_at) VALUES (%s,%s,%s,%s,'active',%s) RETURNING id",
        (data["store_name"],data["owner_name"],data["area"],data["phone"],ts))
    rid=cur.fetchone()["id"]
    cur.execute("INSERT INTO users (name,phone,password_hash,role,retailer_id,created_at) VALUES (%s,%s,%s,'retailer',%s,%s)",
        (data["owner_name"],data["phone"],hp("retailer123"),rid,ts))
    cur.execute("SELECT id,base_price FROM products")
    for p in rows(cur):
        cur.execute("INSERT INTO retailer_products (retailer_id,product_id,selling_price,in_stock,quantity) VALUES (%s,%s,%s,1,25)",(rid,p["id"],round(p["base_price"]*1.08,2)))
    conn.commit(); cur.execute("SELECT * FROM retailers WHERE id=%s",(rid,)); r=row(cur); conn.close()
    return jsonify({**r,"login_phone":data["phone"],"login_password":"retailer123"}),201

@app.route("/api/admin/retailers/<int:rid>/status",methods=["PATCH"])
@auth_required(roles=["admin"])
def admin_toggle_retailer(rid):
    ns=(request.get_json(force=True) or {}).get("status")
    if ns not in ("active","inactive"): return jsonify({"error":"Invalid"}),400
    conn=get_conn(); cur=dc(conn)
    cur.execute("UPDATE retailers SET status=%s WHERE id=%s",(ns,rid)); conn.commit()
    cur.execute("SELECT * FROM retailers WHERE id=%s",(rid,)); r=row(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/products",methods=["GET"])
@auth_required(roles=["admin"])
def admin_products():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT p.*,c.name as category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY c.name,p.name")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/products",methods=["POST"])
@auth_required(roles=["admin"])
def admin_create_product():
    data=request.get_json(force=True)
    for f in ["name","category_id","base_price"]:
        if data.get(f) is None: return jsonify({"error":f"Required: {f}"}),400
    sku=data.get("sku_code") or f"SKU{int(time.time())}"
    conn=get_conn(); cur=dc(conn)
    cur.execute("INSERT INTO products (sku_code,name,brand,category_id,pack_size,base_price,gst_rate,image_emoji,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (sku,data["name"],data.get("brand",""),data["category_id"],data.get("pack_size",""),float(data["base_price"]),float(data.get("gst_rate",5.0)),data.get("image_emoji","🛒"),now()))
    pid=cur.fetchone()["id"]
    cur.execute("SELECT id FROM retailers WHERE status='active'")
    for r in rows(cur):
        cur.execute("INSERT INTO retailer_products (retailer_id,product_id,selling_price,in_stock,quantity) VALUES (%s,%s,%s,1,20)",(r["id"],pid,round(float(data["base_price"])*1.08,2)))
    conn.commit(); cur.execute("SELECT * FROM products WHERE id=%s",(pid,)); r=row(cur); conn.close(); return jsonify(r),201

@app.route("/api/admin/orders")
@auth_required(roles=["admin"])
def admin_orders():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT o.*,r.store_name,u.name as customer_name FROM orders o JOIN retailers r ON r.id=o.retailer_id JOIN users u ON u.id=o.customer_id ORDER BY o.created_at DESC LIMIT 100")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/analytics/retailer-performance")
@auth_required(roles=["admin"])
def admin_perf():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT r.store_name,r.area,COUNT(o.id) as order_count,COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN o.total_amount ELSE 0 END),0) as total_sales,COALESCE(SUM(CASE WHEN o.status IN ('rejected','cancelled') THEN 1 ELSE 0 END),0) as cancelled_count FROM retailers r LEFT JOIN orders o ON o.retailer_id=r.id GROUP BY r.id,r.store_name,r.area ORDER BY total_sales DESC")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/analytics/top-products")
@auth_required(roles=["admin"])
def admin_top_products():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT oi.product_name,SUM(oi.quantity) as total_qty,SUM(oi.line_total) as total_sales FROM order_items oi GROUP BY oi.product_name ORDER BY total_qty DESC LIMIT 10")
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/admin/analytics/order-status-breakdown")
@auth_required(roles=["admin"])
def admin_status():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT status,COUNT(*) as count FROM orders GROUP BY status")
    r=rows(cur); conn.close(); return jsonify(r)

# ── Notifications ──────────────────────────────────────────────────────────────
@app.route("/api/notifications")
@auth_required()
def notifications():
    conn=get_conn(); cur=dc(conn)
    cur.execute("SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 20",(g.user["user_id"],))
    r=rows(cur); conn.close(); return jsonify(r)

@app.route("/api/notifications/<int:nid>/read",methods=["PATCH"])
@auth_required()
def mark_read(nid):
    conn=get_conn(); cur=dc(conn)
    cur.execute("UPDATE notifications SET is_read=1 WHERE id=%s AND user_id=%s",(nid,g.user["user_id"]))
    conn.commit(); conn.close(); return jsonify({"ok":True})

# Vercel entry point
handler = app
