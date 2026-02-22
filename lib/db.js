import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'data', 'db.json');

const defaultDb = {
  users: []
};

export async function ensureDb() {
  try {
    await fs.access(dbPath);
  } catch {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(defaultDb, null, 2), 'utf-8');
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(dbPath, 'utf-8');
  return JSON.parse(raw || JSON.stringify(defaultDb));
}

export async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function createSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function createEmptyFinance(currency = 'USD') {
  return {
    preferences: {
      currency,
      locale: 'en-US',
      refreshIntervalMs: 30000
    },
    transactions: [],
    budgets: {},
    goals: [],
    investments: [],
    recurring: [],
    snapshots: {}
  };
}
