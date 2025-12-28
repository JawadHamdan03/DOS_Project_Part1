import express from "express";
import morgan from "morgan";
import cors from "cors";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));


const PORT = Number(process.env.PORT || 4003);

const IS_PRIMARY =
    String(process.env.IS_PRIMARY || "false").toLowerCase() === "true";

const PEER_URL = process.env.PEER_URL || "http://localhost:4001";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4000";

const DB_PATH = "./db/catalog.db";

if (!existsSync("./db")) mkdirSync("./db");
const db = new Database(DB_PATH);

async function invalidateCache(bookId) {
    try {
        await fetch(`${FRONTEND_URL}/cache/invalidate/${bookId}`, { method: "POST" });
    } catch (e) {
        console.warn(`[Catalog:${PORT}] invalidate failed:`, e?.message || e);
    }
}

async function replicateToPeer(op) {
    if (!IS_PRIMARY) return;

    try {
        await fetch(`${PEER_URL}/internal/replicate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op),
        });
    } catch (e) {
        console.warn(`[Catalog:${PORT}] replicateToPeer failed:`, e?.message || e);
    }
}

function applyWrite(op) {
    const { type } = op;

    if (type === "update_price") {
        const { id, price } = op;
        const info = db.prepare(`UPDATE books SET price = ? WHERE id = ?`).run(price, id);
        if (!info.changes) return { ok: false, code: 404, error: "Item not found" };
        return { ok: true };
    }

    if (type === "update_stock") {
        const { id, delta } = op;

        const row = db.prepare(`SELECT quantity FROM books WHERE id = ?`).get(id);
        if (!row) return { ok: false, code: 404, error: "Item not found" };

        const newQty = row.quantity + delta;
        if (newQty < 0) return { ok: false, code: 409, error: "Stock would go negative" };

        db.prepare(`UPDATE books SET quantity = ? WHERE id = ?`).run(newQty, id);
        return { ok: true, quantity: newQty };
    }

    if (type === "decrement_stock") {
        const { id } = op;

        const info = db.prepare(`
      UPDATE books
      SET quantity = quantity - 1
      WHERE id = ? AND quantity > 0
    `).run(id);

        if (!info.changes) return { ok: false, code: 409, error: "Out of stock" };

        const book = db.prepare(`SELECT quantity FROM books WHERE id = ?`).get(id);
        return { ok: true, quantity: book.quantity };
    }

    return { ok: false, code: 400, error: "Unknown operation" };
}

app.get("/search/:topic", (req, res) => {
    const topic = String(req.params.topic || "").toLowerCase();
    const rows = db.prepare(`SELECT id, title FROM books WHERE topic = ?`).all(topic);
    res.json(rows);
});

app.get("/info/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const book = db.prepare(`
    SELECT id, title, topic, price, quantity FROM books WHERE id = ?
  `).get(id);

    if (!book) return res.status(404).json({ error: "Item not found" });
    res.json(book);
});


app.put("/update/price", async (req, res) => {
    const { id, price } = req.body || {};
    if (!Number.isInteger(id) || !Number.isFinite(price) || price < 0)
        return res.status(400).json({ error: "Invalid id or price" });

    await invalidateCache(id); // BEFORE write
    const local = applyWrite({ type: "update_price", id, price });
    if (!local.ok) return res.status(local.code).json({ error: local.error });

    await replicateToPeer({ type: "update_price", id, price });
    res.json({ ok: true, primary: IS_PRIMARY, port: PORT });
});

app.put("/update/stock", async (req, res) => {
    const { id, delta } = req.body || {};
    if (!Number.isInteger(id) || !Number.isInteger(delta))
        return res.status(400).json({ error: "Invalid id or delta" });

    await invalidateCache(id);
    const local = applyWrite({ type: "update_stock", id, delta });
    if (!local.ok) return res.status(local.code).json({ error: local.error });

    await replicateToPeer({ type: "update_stock", id, delta });
    res.json({ ok: true, quantity: local.quantity, primary: IS_PRIMARY, port: PORT });
});

app.put("/stock/decrement/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    await invalidateCache(id);
    const local = applyWrite({ type: "decrement_stock", id });
    if (!local.ok) return res.status(local.code).json({ error: local.error });

    await replicateToPeer({ type: "decrement_stock", id });
    res.json({ ok: true, quantity: local.quantity, primary: IS_PRIMARY, port: PORT });
});

app.post("/internal/replicate", (req, res) => {
    const op = req.body || {};
    const result = applyWrite(op);
    if (!result.ok) return res.status(result.code || 500).json({ error: result.error || "replicate failed" });
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`📚 Catalog replica running on http://localhost:${PORT}`);
    console.log(`   Primary: ${IS_PRIMARY}`);
    console.log(`   Peer: ${PEER_URL}`);
    console.log(`   Front: ${FRONTEND_URL}`);
    console.log(`   DB: ${DB_PATH}`);
});
