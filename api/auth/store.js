import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

function resolveAuthDbPath() {
  const configuredPath = process.env.YOUZ_AUTH_DB_PATH;
  if (configuredPath) return configuredPath;

  const preferred = path.join(process.cwd(), 'data', 'youz-auth-users.json');
  try {
    fs.mkdirSync(path.dirname(preferred), { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join('/tmp', 'youz-data', 'youz-auth-users.json');
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    return fallback;
  }
}

const authDbPath = resolveAuthDbPath();

function loadUsersMap() {
  try {
    if (!fs.existsSync(authDbPath)) return new Map();
    const raw = fs.readFileSync(authDbPath, 'utf8');
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return new Map();
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistUsersMap(usersMap) {
  try {
    const payload = Object.fromEntries(usersMap.entries());
    fs.writeFileSync(authDbPath, JSON.stringify(payload, null, 2));
  } catch {}
}

const db = globalThis.__youzAuthDb || {
  users: loadUsersMap()
};

globalThis.__youzAuthDb = db;

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function findUserByEmail(email = '') {
  return db.users.get(String(email).trim().toLowerCase()) || null;
}

export function saveUser({ name, email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim() || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail)}&background=3b82f6&color=fff`,
    passwordHash: hashPassword(password),
    provider: 'email',
    createdAt: new Date().toISOString()
  };
  db.users.set(normalizedEmail, user);
  persistUsersMap(db.users);
  return user;
}
