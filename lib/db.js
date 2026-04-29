import path from 'node:path';
import fs from 'node:fs';

function resolveDbPath() {
  const configuredPath = process.env.YOUZ_DB_PATH;
  if (configuredPath) return configuredPath;

  const preferredPath = path.join(process.cwd(), 'data', 'youz-db.json');
  try {
    fs.mkdirSync(path.dirname(preferredPath), { recursive: true });
    return preferredPath;
  } catch {
    const fallbackPath = path.join('/tmp', 'youz-data', 'youz-db.json');
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    return fallbackPath;
  }
}

const dbPath = resolveDbPath();

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

let localStore = globalThis.__youzStore || loadStore();
globalThis.__youzStore = localStore;

function persistStore() {
  fs.writeFileSync(dbPath, JSON.stringify(localStore, null, 2));
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseClient = null;

async function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (supabaseClient) return supabaseClient;
  const mod = await import('@supabase/supabase-js');
  supabaseClient = mod.createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
  return supabaseClient;
}

export function resolveUserKey(req, userContext = {}) {
  const email = String(userContext?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const id = String(userContext?.id || '').trim();
  if (id) return `id:${id}`;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'guest').split(',')[0].trim();
  return `guest:${ip || 'unknown'}`;
}

async function getPremiumRow(userKey) {
  const supabase = await getSupabase();
  if (!supabase) return localStore.premium_users[userKey] || null;
  const { data } = await supabase
    .from('premium_users')
    .select('*')
    .eq('user_key', userKey)
    .maybeSingle();
  return data || null;
}

export async function getUserPlan(userKey) {
  const row = await getPremiumRow(userKey);
  if (!row) return 'free';
  const now = new Date().toISOString();
  if (row.status === 'active' && row.expires_at >= now) return row.plan_name === 'premium' ? 'premium' : 'free';
  return 'free';
}

export async function getUsage(userKey, date = isoDate()) {
  const supabase = await getSupabase();
  if (!supabase) {
    const row = localStore.usage_daily[usageKey(userKey, date)] || { chat_count: 0, image_count: 0 };
    return { chat: row.chat_count || 0, image: row.image_count || 0 };
  }
  const { data } = await supabase
    .from('usage_daily')
    .select('chat_count,image_count')
    .eq('user_key', userKey)
    .eq('usage_date', date)
    .maybeSingle();
  return {
    chat: data?.chat_count || 0,
    image: data?.image_count || 0
  };
}

export async function consumeQuota({ userKey, type, amount = 1 }) {
  const usageDate = isoDate();
  const plan = await getUserPlan(userKey);
  const limit = PLAN_LIMITS[plan][type];
  const usage = await getUsage(userKey, usageDate);
  const current = type === 'chat' ? usage.chat : usage.image;
  
  if (current + amount > limit) {
    return { success: false, plan, usage, limit, remaining: Math.max(0, limit - current), usageDate };
  }

  const supabase = await getSupabase();
  if (!supabase) {
    const key = usageKey(userKey, usageDate);
    const row = localStore.usage_daily[key] || { chat_count: 0, image_count: 0 };
    if (type === 'chat') row.chat_count += amount;
    else row.image_count += amount;
    localStore.usage_daily[key] = row;
    persistStore();
  } else {
    await supabase.from('usage_daily').upsert({
      user_key: userKey,
      usage_date: usageDate,
      chat_count: type === 'chat' ? current + amount : usage.chat,
      image_count: type === 'image' ? current + amount : usage.image
    }, { onConflict: 'user_key,usage_date' });
  }

  const updated = await getUsage(userKey, usageDate);
  return {
    success: true,
    plan,
    usage: updated,
    limit,
    remaining: Math.max(0, limit - (type === 'chat' ? updated.chat : updated.image)),
    usageDate
  };
}

export async function getQuotaSnapshot(userKey) {
  const usageDate = isoDate();
  const plan = await getUserPlan(userKey);
  const usage = await getUsage(userKey, usageDate);
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

 export async function saveConversationTurn({ userKey, conversationId = '', model = 'unknown', action = 'chat', userMessage = '', assistantMessage = '' }) {
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_key: userKey,
    conversation_id: conversationId,
    model,
    action,
    user_message: userMessage,
    assistant_message: assistantMessage,
    created_at: new Date().toISOString()
    };

  const supabase = await getSupabase();
  if (!supabase) {
    localStore.chat_history.push(row);
    if (localStore.chat_history.length > 5000) {
      localStore.chat_history = localStore.chat_history.slice(-5000);
    }
    persistStore();
    return;
  }

   await supabase.from('chat_history').insert(row);
}

export async function createPremiumRequest({ userKey, name, email, method, notes }) {
  const normalizedMethod = ['qris', 'dana', 'gopay'].includes(method) ? method : 'qris';
  const createdAt = new Date().toISOString();
  
  const supabase = await getSupabase();
  if (!supabase) {
    const row = {
      id: localStore.premium_requests.length + 1,
      user_key: userKey,
      name: name || '',
      email: email || '',
      method: normalizedMethod,
      notes: notes || '',
      status: 'pending',
      created_at: createdAt
    };
    localStore.premium_requests.push(row);
    persistStore();
    return { id: row.id, status: 'pending', method: normalizedMethod, createdAt };
  }

const { data } = await supabase
    .from('premium_requests')
    .insert({
      user_key: userKey,
      name: name || '',
      email: email || '',
      method: normalizedMethod,
      notes: notes || '',
      status: 'pending',
      created_at: createdAt
    })
    .select('id')
    .single();

  return { id: data?.id || null, status: 'pending', method: normalizedMethod, createdAt };
}

export async function confirmPremium({ userKey, months = 1, admin = 'admin' }) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  const row = {
    user_key: userKey,
    plan_name: 'premium',
    status: 'active',
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    confirmed_by: admin,
    updated_at: new Date().toISOString()
  };
  
  const supabase = await getSupabase();
  if (!supabase) {
    localStore.premium_users[userKey] = row;
    persistStore();
    return;
  }

  await supabase.from('premium_users').upsert(row, { onConflict: 'user_key' });
}
