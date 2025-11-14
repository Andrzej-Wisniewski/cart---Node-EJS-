import fs from 'fs';
import { initDb } from '../src/db.js';

const DB_FILE = process.env.DB_FILE || 'shop.db';
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log('Removed', DB_FILE);
}

await initDb();
console.log('Database created and seeded.');
