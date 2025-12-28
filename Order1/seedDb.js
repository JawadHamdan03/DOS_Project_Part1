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

console.log('✅ orders.db created and seeded successfully.');
db.close();
