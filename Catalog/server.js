import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';

const PORT = process.env.PORT || 4001;
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

if (!existsSync('./db')) mkdirSync('./db');

const db = new Database('./db/catalog.db');

// search by topic
app.get('/search/:topic', (req, res) => {
    const topic = String(req.params.topic || '').toLowerCase();
    const stmt = db.prepare(`SELECT id, title FROM books WHERE topic = ?`);
    const rows = stmt.all(topic);
    res.json(rows);
});

// get info by id
app.get('/info/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const book = db.prepare(`
    SELECT id, title, topic, price, quantity FROM books WHERE id = ?
  `).get(id);

    if (!book) return res.status(404).json({ error: 'Item not found' });
    res.json(book);
});

// update price
app.put('/update/price', (req, res) => {
    const { id, price } = req.body || {};
    if (!Number.isInteger(id) || !Number.isFinite(price) || price < 0)
        return res.status(400).json({ error: 'Invalid id or price' });

    const info = db.prepare(`UPDATE books SET price = ? WHERE id = ?`).run(price, id);
    if (info.changes === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ ok: true });
});

// update stock quantity
app.put('/update/stock', (req, res) => {
    const { id, delta } = req.body || {};
    if (!Number.isInteger(id) || !Number.isInteger(delta))
        return res.status(400).json({ error: 'Invalid id or delta' });

    const row = db.prepare(`SELECT quantity FROM books WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: 'Item not found' });

    const newQty = row.quantity + delta;
    if (newQty < 0) return res.status(409).json({ error: 'Stock would go negative' });

    db.prepare(`UPDATE books SET quantity = ? WHERE id = ?`).run(newQty, id);
    res.json({ ok: true, quantity: newQty });
});

// atomic decrement stock
app.put('/stock/decrement/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const info = db.prepare(`
    UPDATE books
    SET quantity = quantity - 1
    WHERE id = ? AND quantity > 0
  `).run(id);

    if (info.changes === 0) return res.status(409).json({ error: 'Out of stock' });

    const book = db.prepare(`SELECT id, title, price, quantity FROM books WHERE id = ?`).get(id);
    res.json({ ok: true, quantity: book.quantity });
});

app.listen(PORT, () => {
    console.log(`📚 Catalog service listening on http://localhost:${PORT}`);
});