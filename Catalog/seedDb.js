import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';

if (!existsSync('./db')) mkdirSync('./db');

const db = new Database('./db/catalog.db');

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL CHECK (topic IN ('distributed systems','undergraduate school')),
    price INTEGER NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0)
  );

  DELETE FROM books;
`);

const books = [
    { id: 1, title: 'How to get a good grade in DOS in 40 minutes a day', topic: 'distributed systems', price: 40, quantity: 5 },
    { id: 2, title: 'RPCs for Noobs', topic: 'distributed systems', price: 50, quantity: 5 },
    { id: 3, title: 'Xen and the Art of Surviving Undergraduate School', topic: 'undergraduate school', price: 60, quantity: 5 },
    { id: 4, title: 'Cooking for the Impatient Undergrad', topic: 'undergraduate school', price: 30, quantity: 5 }
];

const insert = db.prepare(`
  INSERT INTO books (id, title, topic, price, quantity)
  VALUES (@id, @title, @topic, @price, @quantity)
`);
const trx = db.transaction(rows => rows.forEach(r => insert.run(r)));
trx(books);

console.log('✅ Catalog seeded.');
db.close();