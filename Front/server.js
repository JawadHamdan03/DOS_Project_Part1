import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT = Number(process.env.PORT || 4000);


const CATALOG_REPLICAS = (process.env.CATALOG_REPLICAS || "http://localhost:4001,http://localhost:4003")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ORDER_REPLICAS = (process.env.ORDER_REPLICAS || "http://localhost:4002,http://localhost:4004")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// to implement Load Balancing
let catIdx = 0;
let ordIdx = 0;

function pickCatalog() {
  const url = CATALOG_REPLICAS[catIdx % CATALOG_REPLICAS.length];
  catIdx = (catIdx + 1) % CATALOG_REPLICAS.length;
  return url;
}

function pickOrder() {
  const url = ORDER_REPLICAS[ordIdx % ORDER_REPLICAS.length];
  ordIdx = (ordIdx + 1) % ORDER_REPLICAS.length;
  return url;
}

//  In-Memory Cache for read only 
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 30_000);
const CACHE_MAX = Number(process.env.CACHE_MAX || 200);

const cache = new Map(); // key -> { value, expiresAt }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { // if the value is expired then deleted 
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;    // returns the value 
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateBook(id) {
  cache.delete(`info:${id}`);
}

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



// Invalidate endpoint => server-push implementation
app.post("/cache/invalidate/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  invalidateBook(id);
  res.json({ ok: true, invalidated: id });
});

// testing , not important
app.post("/cache/clear", (_req, res) => {
  cache.clear();
  res.json({ ok: true });
});

// search => uses the cache and it could hit or mis 
app.get("/search/:topic", async (req, res) => {
  const topic = String(req.params.topic || "");
  const key = `search:${topic.toLowerCase()}`;

  const hit = cacheGet(key);
  if (hit) return res.json({ cached: true, data: hit });

  const catalogURL = pickCatalog();
  const r = await httpJSON(`${catalogURL}/search/${encodeURIComponent(topic)}`);
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: "Catalog error" });

  cacheSet(key, r.data);
  res.json({ cached: false, replica: catalogURL, data: r.data });
});

// get info => uses the cache
app.get("/info/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const key = `info:${id}`;
  const hit = cacheGet(key);
  if (hit) return res.json({ cached: true, data: hit });

  const catalogURL = pickCatalog();
  const r = await httpJSON(`${catalogURL}/info/${id}`);
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: "Catalog error" });

  cacheSet(key, r.data);
  res.json({ cached: false, replica: catalogURL, data: r.data });
});

// purchase : not a read operation and it invalidates the cache
app.post("/purchase/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const orderURL = pickOrder();
  const r = await httpJSON(`${orderURL}/purchase/${id}`, { method: "POST" });
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: "Order error" });

  res.status(201).json({ replica: orderURL, ...r.data });
});

app.listen(PORT, () => {
  console.log(`🌐 Front service listening on http://localhost:${PORT}`);
  console.log(`→ Catalog replicas: ${CATALOG_REPLICAS.join(" , ")}`);
  console.log(`→ Order replicas:   ${ORDER_REPLICAS.join(" , ")}`);
});
