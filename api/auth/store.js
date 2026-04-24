import crypto from 'crypto';

const db = globalThis.__youzAuthDb || {
  users: new Map()
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
    provider: 'email'
  };
  db.users.set(normalizedEmail, user);
  return user;
}
