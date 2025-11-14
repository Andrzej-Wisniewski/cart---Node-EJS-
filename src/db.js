import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

const DB_FILE = process.env.DB_FILE || 'shop.db';
export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);

  db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL CHECK (qty > 0),
      price REAL NOT NULL CHECK (price >= 0)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      percent INTEGER NOT NULL CHECK (percent > 0 AND percent <= 100)
    );
  `);

  if (firstTime) await seed();
}

async function seed() {
  await db.exec('BEGIN TRANSACTION');
  try {
    await db.run('INSERT INTO products(name,price) VALUES (?,?)', [
      'Laptop',
      3500,
    ]);
    await db.run('INSERT INTO products(name,price) VALUES (?,?)', [
      'Monitor',
      700,
    ]);
    await db.run('INSERT INTO products(name,price) VALUES (?,?)', [
      'Myszka',
      80,
    ]);
    await db.run('INSERT INTO coupons(code,percent) VALUES (?,?)', [
      'WELCOME10',
      10,
    ]);
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
