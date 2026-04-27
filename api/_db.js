import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.YOUZ_SQLITE_PATH || path.join(process.cwd(), 'data', 'youz.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = globalThis.__youzSqliteDb || new DatabaseSync(dbPath);

globalThis.__youzSqliteDb = db;

db.exec(`
  CREATE TABLE IF NOT EXISTS usage_daily (
    user_key TEXT NOT NULL,
    usage_date TEXT NOT NULL,
    chat_count INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_key, usage_date)
  );

  CREATE TABLE IF NOT EXISTS premium_users (
    user_key TEXT PRIMARY KEY,
    plan_name TEXT NOT NULL DEFAULT 'premium',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    confirmed_by TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS premium_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    name TEXT,
    email TEXT,
    method TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
`);

const PLAN_LIMITS = {
  free: { chat: 20, image: 3 },
  premium: { chat: 120, image: 15 }
};

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveUserKey(req, userContext = {}) {
  const email = String(userContext?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const id = String(userContext?.id || '').trim();
  if (id) return `id:${id}`;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'guest').split(',')[0].trim();
  return `guest:${ip || 'unknown'}`;
}

export function getUserPlan(userKey) {
  const now = new Date().toISOString();
  const row = db.prepare(
    `SELECT plan_name FROM premium_users WHERE user_key = ? AND status = 'active' AND expires_at >= ? LIMIT 1`
  ).get(userKey, now);
  return row?.plan_name === 'premium' ? 'premium' : 'free';
}

export function getUsage(userKey, date = isoDate()) {
  const row = db.prepare(`SELECT chat_count, image_count FROM usage_daily WHERE user_key = ? AND usage_date = ?`).get(userKey, date);
  return { chat: row?.chat_count || 0, image: row?.image_count || 0 };
}

export function consumeQuota({ userKey, type, amount = 1 }) {
  const usageDate = isoDate();
  const plan = getUserPlan(userKey);
  const limit = PLAN_LIMITS[plan][type];
  const usage = getUsage(userKey, usageDate);
  const current = type === 'chat' ? usage.chat : usage.image;
  if (current + amount > limit) {
    return { success: false, plan, usage, limit, remaining: Math.max(0, limit - current), usageDate };
  }

  db.prepare(
    `INSERT INTO usage_daily (user_key, usage_date, chat_count, image_count)
      VALUES (?, ?, 0, 0)
      ON CONFLICT(user_key, usage_date) DO NOTHING`
  ).run(userKey, usageDate);

  if (type === 'chat') {
    db.prepare(`UPDATE usage_daily SET chat_count = chat_count + ? WHERE user_key = ? AND usage_date = ?`).run(amount, userKey, usageDate);
  } else {
    db.prepare(`UPDATE usage_daily SET image_count = image_count + ? WHERE user_key = ? AND usage_date = ?`).run(amount, userKey, usageDate);
  }

  const updated = getUsage(userKey, usageDate);
  return {
    success: true,
    plan,
    usage: updated,
    limit,
    remaining: Math.max(0, limit - (type === 'chat' ? updated.chat : updated.image)),
    usageDate
  };
}

export function getQuotaSnapshot(userKey) {
  const usageDate = isoDate();
  const plan = getUserPlan(userKey);
  const usage = getUsage(userKey, usageDate);
  const limits = PLAN_LIMITS[plan];
  return {
    plan,
    usageDate,
    usage,
    limits,
    remaining: {
      chat: Math.max(0, limits.chat - usage.chat),
      image: Math.max(0, limits.image - usage.image)
    }
  };
}

export function createPremiumRequest({ userKey, name, email, method, notes }) {
  const normalizedMethod = ['qris', 'dana', 'gopay'].includes(method) ? method : 'qris';
  const createdAt = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO premium_requests (user_key, name, email, method, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(userKey, name || '', email || '', normalizedMethod, notes || '', createdAt);
  return { id: result.lastInsertRowid, status: 'pending', method: normalizedMethod, createdAt };
}

export function confirmPremium({ userKey, months = 1, admin = 'admin' }) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  const nowIso = new Date().toISOString();
  db.prepare(
    `INSERT INTO premium_users (user_key, plan_name, status, started_at, expires_at, confirmed_by, updated_at)
     VALUES (?, 'premium', 'active', ?, ?, ?, ?)
     ON CONFLICT(user_key) DO UPDATE SET
      plan_name='premium', status='active', started_at=excluded.started_at,
      expires_at=excluded.expires_at, confirmed_by=excluded.confirmed_by, updated_at=excluded.updated_at`
  ).run(userKey, startedAt.toISOString(), expiresAt.toISOString(), admin, nowIso);
}
