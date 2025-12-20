import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';

if (!existsSync('./db')) mkdirSync('./db');

const db = new Database('./db/orders.db');

db.pragma('journal_mode = WAL');

db.exec(`
  DROP TABLE IF EXISTS orders;

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
    created_at TEXT NOT NULL
  );
`);

const insert = db.prepare(`
  INSERT INTO orders (item_id, title, price, status, created_at)
  VALUES (@item_id, @title, @price, @status, datetime('now'))
`);

const sampleOrders = [
  { item_id: 1, title: 'How to get a good grade in DOS in 40 minutes a day', price: 40, status: 'SUCCESS' },
  { item_id: 4, title: 'Cooking for the Impatient Undergrad', price: 30, status: 'FAILED' }
];

const trx = db.transaction(rows => rows.forEach(r => insert.run(r)));
trx(sampleOrders);

console.log('✅ orders.db created and seeded successfully.');
db.close();
