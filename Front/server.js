// front/index.js — API Gateway (Front service)
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;
const CATALOG_URL = process.env.CATALOG_URL || 'http://localhost:4001';
const ORDER_URL   = process.env.ORDER_URL   || 'http://localhost:4002';

// fetch helper
async function httpJSON(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: r.ok, status: r.status, data };
}

// check
app.get('/health', (_req, res) => {
  res.json({ ok: true, catalog: CATALOG_URL, order: ORDER_URL });
});


 //  search/:topic  → deals with Catalog
app.get('/search/:topic', async (req, res) => {
  const topic = req.params.topic;
  const r = await httpJSON(`${CATALOG_URL}/search/${encodeURIComponent(topic)}`);
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: 'Catalog error' });
  res.json(r.data);
});


  //info/:id  → deals with Catalog
app.get('/info/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const r = await httpJSON(`${CATALOG_URL}/info/${id}`);
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: 'Catalog error' });
  res.json(r.data);
});


 // purchase/:id  → deals with Order
 
app.post('/purchase/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const r = await httpJSON(`${ORDER_URL}/purchase/${id}`, { method: 'POST' });
  if (!r.ok) return res.status(r.status).json(r.data ?? { error: 'Order error' });
  res.status(201).json(r.data);
});

app.listen(PORT, () => {
  console.log(`🌐 Front service listening on http://localhost:${PORT}`);
  console.log(`→ Catalog: ${CATALOG_URL}`);
  console.log(`→ Order:   ${ORDER_URL}`);
});
