# FreshLine — Deploy to Vercel + Neon

This folder contains the production-ready version of the FreshLine MVP,
adapted for deployment on **Vercel** (frontend + Python API) and **Neon**
(serverless PostgreSQL database).

## Architecture

```
Vercel project
├── /api/index.py      Flask app as a Vercel Python serverless function
├── /api/database.py   PostgreSQL connection + schema + seed logic
├── /frontend/         React + Vite app (built to /frontend/dist/)
└── vercel.json        Routing: /api/* → Python, everything else → React SPA
```

All three roles (Customer, Retailer, Admin) are served from a single Vercel
deployment. The frontend is built as a static site; the backend runs as
serverless Python functions on every API request.

---

## Step 1 — Create a Neon database

1. Go to [neon.tech](https://neon.tech) and sign up / log in.
2. Click **New Project**, name it `freshline`, choose the region closest to
   your users (Mumbai / Singapore for India).
3. Once created, go to **Connection Details** → switch the format to
   **psycopg2** and copy the full connection string. It looks like:
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/freshline?sslmode=require
   ```
4. Keep this — you'll paste it into Vercel next.

> The database schema and demo data are created automatically the first time
> the API receives a request. You don't need to run any migration scripts.

---

## Step 2 — Deploy to Vercel

### Option A — Vercel dashboard (easiest)

1. Push this `grocery-vercel/` folder to a GitHub repo
   (or zip and drag-drop to Vercel).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** →
   import your repo.
3. Vercel will auto-detect the `vercel.json` config — no framework preset
   needed, just leave everything as detected.
4. Before deploying, click **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `JWT_SECRET` | any long random string, e.g. `openssl rand -hex 32` |

5. Click **Deploy**. Vercel will:
   - Install Python dependencies from `api/requirements.txt`
   - Run `cd frontend && npm install && npm run build`
   - Serve the built React app at your `.vercel.app` domain
   - Route all `/api/*` requests to the Python serverless function

### Option B — Vercel CLI

```bash
# Install Vercel CLI (one time)
npm install -g vercel

# From the grocery-vercel/ folder:
cd grocery-vercel

# Set environment variables first
vercel env add DATABASE_URL
vercel env add JWT_SECRET

# Deploy
vercel --prod
```

---

## Step 3 — Verify it's working

Open your Vercel URL and hit the health endpoint:
```
https://your-app.vercel.app/api/health
```
Should return: `{"service": "freshline-api", "status": "ok"}`

Then open the app URL in your browser — you'll see the FreshLine login screen.
The database will seed automatically on first login attempt.

---

## Demo accounts (seeded automatically)

| Role | Phone | Password |
|------|-------|----------|
| Customer | 9000000001 | customer123 |
| Customer | 9000000002 | customer123 |
| Retailer (Sharma General Store) | 9820011111 | retailer123 |
| Retailer (Quick Mart Bandra) | 9820022222 | retailer123 |
| Retailer (Daily Needs Powai) | 9820033333 | retailer123 |
| Admin / Stockist | 9999999999 | admin123 |

---

## Local development (unchanged from the original MVP)

The local dev setup still uses SQLite — no Neon/PostgreSQL needed locally:

```bash
# Terminal 1 — backend
cd ../grocery-mvp/backend
pip install -r requirements.txt
python app.py

# Terminal 2 — frontend (now with /api proxy built in)
cd grocery-vercel/frontend
npm install
npm run dev
```

The frontend's `vite.config.js` proxies `/api` calls to `localhost:5000` during
development, so the same codebase works locally and on Vercel.

---

## Resetting the database

To reset to fresh demo data: in the Neon dashboard, go to your project →
**Branches** → select your branch → **Reset to empty** (or just
`DROP TABLE ... CASCADE` for each table via the Neon SQL editor). The next
API request will re-create the schema and seed the demo data.
