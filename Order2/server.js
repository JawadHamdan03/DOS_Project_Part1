import express from "express";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";

const app = express();
app.use(express.json());


const PORT = 4004;

const CATALOG_PRIMARY_URL = "http://localhost:4001";

const DB_PATH = "./db/orders.db";

if (!existsSync("./db")) mkdirSync("./db");

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
    created_at TEXT NOT NULL
  );
`);


async function httpJSON(url, opts = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}

function logOrder({ item_id, title, price, status }) {
  const stmt = db.prepare(`
    INSERT INTO orders (item_id, title, price, status, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  return stmt.run(item_id, title, price, status).lastInsertRowid;
}

app.post("/purchase/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid item id" });

  const info = await httpJSON(`${CATALOG_PRIMARY_URL}/info/${id}`);
  if (!info.ok)
    return res.status(info.status).json({ error: "Catalog item not found" });

  const { title, price } = info.data;

  // decrement stock (Catalog will invalidate cache before write)
  const dec = await httpJSON(
    `${CATALOG_PRIMARY_URL}/stock/decrement/${id}`,
    { method: "PUT" }
  );

  if (!dec.ok) {
    const oid = logOrder({ item_id: id, title, price, status: "FAILED" });
    return res.status(dec.status).json({
      error: dec.data?.error || "Purchase failed",
      order_id: oid,
    });
  }

  const oid = logOrder({ item_id: id, title, price, status: "SUCCESS" });
  res.status(201).json({
    ok: true,
    order_id: oid,
    item_id: id,
    title,
    price,
    message: "Purchase successful",
  });
});

app.get("/orders", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all();
  res.json(rows);
});

app.get("/orders/:id", (req, res) => {
  const oid = Number(req.params.id);
  if (!Number.isInteger(oid) || oid <= 0)
    return res.status(400).json({ error: "Invalid order id" });

  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(oid);
  if (!row) return res.status(404).json({ error: "Order not found" });
  res.json(row);
});

app.listen(PORT, () => {
  console.log(`🧾 Order replica running on http://localhost:${PORT}`);
  console.log(`   Catalog Primary: ${CATALOG_PRIMARY_URL}`);
  console.log(`   DB: ${DB_PATH}`);
});
