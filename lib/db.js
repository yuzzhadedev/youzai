import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.YOUZ_DB_PATH || path.join(process.cwd(), 'data', 'youz-db.json');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

function createDefaultStore() {
  return {
    usage_daily: {},
    premium_users: {},
    premium_requests: [],
    chat_history: []
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initial = createDefaultStore();
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(dbPath, 'utf8');
    return { ...createDefaultStore(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return createDefaultStore();
  }
}

let store = globalThis.__youzStore || loadStore();
globalThis.__youzStore = store;

function persistStore() {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

const PLAN_LIMITS = {
  free: { chat: 20, image: 3 },
  premium: { chat: 120, image: 15 }
};

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function usageKey(userKey, date) {
  return `${userKey}::${date}`;
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
  const row = store.premium_users[userKey];
  if (!row) return 'free';
  const now = new Date().toISOString();
  if (row.status === 'active' && row.expires_at >= now) return row.plan_name === 'premium' ? 'premium' : 'free';
  return 'free';
}

export function getUsage(userKey, date = isoDate()) {
  const row = store.usage_daily[usageKey(userKey, date)] || { chat_count: 0, image_count: 0 };
  return { chat: row.chat_count || 0, image: row.image_count || 0 };
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

  const key = usageKey(userKey, usageDate);
  const row = store.usage_daily[key] || { chat_count: 0, image_count: 0 };
  if (type === 'chat') row.chat_count += amount;
  else row.image_count += amount;
  store.usage_daily[key] = row;
  persistStore();

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

export function saveConversationTurn({ userKey, conversationId = '', model = 'unknown', action = 'chat', userMessage = '', assistantMessage = '' }) {
  store.chat_history.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_key: userKey,
    conversation_id: conversationId,
    model,
    action,
    user_message: userMessage,
    assistant_message: assistantMessage,
    created_at: new Date().toISOString()
  });
  if (store.chat_history.length > 5000) {
    store.chat_history = store.chat_history.slice(-5000);
  }
  persistStore();
}

export function createPremiumRequest({ userKey, name, email, method, notes }) {
  const normalizedMethod = ['qris', 'dana', 'gopay'].includes(method) ? method : 'qris';
  const createdAt = new Date().toISOString();
  const row = {
    id: store.premium_requests.length + 1,
    user_key: userKey,
    name: name || '',
    email: email || '',
    method: normalizedMethod,
    notes: notes || '',
    status: 'pending',
    created_at: createdAt
  };
  store.premium_requests.push(row);
  persistStore();
  return { id: row.id, status: 'pending', method: normalizedMethod, createdAt };
}

export function confirmPremium({ userKey, months = 1, admin = 'admin' }) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  store.premium_users[userKey] = {
    plan_name: 'premium',
    status: 'active',
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    confirmed_by: admin,
    updated_at: new Date().toISOString()
  };
  persistStore();
}
