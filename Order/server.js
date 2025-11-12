import Database from "better-sqlite3";
import express from "express";
import { existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";

const PORT = process.env.PORT || 4002;
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:4001";

if (!existsSync("./db")) mkdirSync("./db");

const db = new Database("./db/orders.db");
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

const app = express();
app.use(express.json());

//  helper
async function getJSON(url, opts = {}) {
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

// purchase by id
app.post("/purchase/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid item id" });

  // check if item exists
  const info = await getJSON(`${CATALOG_URL}/info/${id}`);
  if (!info.ok)
    return res.status(info.status).json({ error: "Catalog info not found" });
  const { title, price, quantity } = info.data;

  // decrement stock of fetched item
  let dec = await getJSON(`${CATALOG_URL}/stock/decrement/${id}`, {
    method: "PUT",
  });

  if (dec.status === 404) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const oid = logOrder({ item_id: id, title, price, status: "FAILED" });
      return res.status(409).json({ error: "Out of stock", order_id: oid });
    }
    dec = await getJSON(`${CATALOG_URL}/update/stock`, {
      method: "PUT",
      body: JSON.stringify({ id, delta: -1 }),
    });
  }

  if (!dec.ok) {
    const oid = logOrder({ item_id: id, title, price, status: "FAILED" });
    return res
      .status(dec.status)
      .json({ error: "Could not reserve item", order_id: oid });
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

//  get all orders
app.get("/orders", (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all();
  res.json(rows);
});

// get order by id
app.get("/orders/:id", (req, res) => {
  const oid = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(oid);
  if (!row) return res.status(404).json({ error: "Order not found" });
  res.json(row);
});

app.listen(PORT, () => {
  console.log(
    `🧾 Order service on http://localhost:${PORT} (catalog: ${CATALOG_URL})`
  );
});
