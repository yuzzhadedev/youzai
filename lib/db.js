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
    chat_history: [],
    user_profiles: {}
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
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
let supabaseClient = null;

async function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (supabaseClient) return supabaseClient;
  const mod = await import('@supabase/supabase-js');
  supabaseClient = mod.createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`
      }
    }
  });
  return supabaseClient;
}



export async function readTable(tableName, { columns = '*', filters = {}, limit = null, single = false } = {}) {
  const name = String(tableName || '').trim();
  if (!name) throw new Error('tableName wajib diisi');

  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase belum dikonfigurasi (SUPABASE_URL dan key)');

  let query = supabase.from(name).select(columns);
  for (const [key, value] of Object.entries(filters || {})) {
    query = query.eq(key, value);
  }
  if (Number.isInteger(limit) && limit > 0) query = query.limit(limit);
  if (single) query = query.maybeSingle();

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'SELECT gagal');
  return data;
}
export function resolveUserKey(req, userContext = {}) {
  const contextEmail = String(userContext?.email || userContext?.userEmail || '').trim().toLowerCase();
  if (contextEmail) return `email:${contextEmail}`;

  const cookie = String(req?.headers?.cookie || '');
  const match = cookie.match(/(?:^|;\s*)youz_user=([^;]+)/);
  if (match?.[1]) {
    try {
      const cookieUser = JSON.parse(decodeURIComponent(match[1]));
      const cookieEmail = String(cookieUser?.email || '').trim().toLowerCase();
      if (cookieEmail) return `email:${cookieEmail}`;
      const cookieId = String(cookieUser?.id || cookieUser?.sub || cookieUser?.user_id || cookieUser?._id || '').trim();
      if (cookieId) return `id:${cookieId}`;
    } catch {}
  }

  const id = String(userContext?.id || userContext?.sub || userContext?.user_id || userContext?._id || '').trim();
  if (id) return `id:${id}`;

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'guest').split(',')[0].trim();
  return `guest:${ip || 'unknown'}`;
}


function buildUserKeyCandidates(userKey = '') {
  const normalized = String(userKey || '').trim().toLowerCase();
  if (!normalized) return [];
  const out = new Set([normalized]);
  if (normalized.startsWith('email:')) out.add(normalized.slice(6));
  else if (normalized.includes('@')) out.add(`email:${normalized}`);
  return [...out].filter(Boolean);
}

function extractEmailCandidates(candidates = []) {
  const out = new Set();
  for (const candidate of candidates) {
    const value = String(candidate || '').trim().toLowerCase();
    if (!value) continue;
    if (value.startsWith('email:')) out.add(value.slice(6));
    if (value.includes('@')) out.add(value);
  }
  return [...out].filter(Boolean);
}

async function getPremiumRow(userKey) {
  if (!userKey || String(userKey).startsWith('guest:')) return null;
  const candidates = buildUserKeyCandidates(userKey);
  if (!candidates.length) return null;

  const supabase = await getSupabase();
  if (!supabase) return null;

  const emailCandidates = extractEmailCandidates(candidates);
  let data = null;
  let error = null;

  if (emailCandidates.length > 0) {
    ({ data, error } = await supabase
      .from('premium_users')
      .select('*')
      .in('user_key', candidates)
      .or(`email.in.(${emailCandidates.join(',')})`)
      .order('updated_at', { ascending: false })
      .limit(1));
  } else {
    ({ data, error } = await supabase
      .from('premium_users')
      .select('*')
      .in('user_key', candidates)
      .order('updated_at', { ascending: false })
      .limit(1));
  }

  if (!error && Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
}

export async function getUserPlan(userKey) {
  if (!userKey || String(userKey).startsWith('guest:')) return 'free';
  const row = await getPremiumRow(userKey);
  if (!row) return 'free';

  const status = String(row.status ?? 'active').trim().toLowerCase();
  const planName = String(row.plan_name || '').trim().toLowerCase();
  const isPremiumPlan = planName === 'premium' || planName.startsWith('premium');
  const isActiveStatus = !status || ['active', 'confirmed', 'paid', 'success'].includes(status);
  if (!isActiveStatus || !isPremiumPlan) return 'free';

  if (!row.expires_at) return 'premium';
  const expiresMs = Date.parse(row.expires_at);
  if (Number.isNaN(expiresMs)) return 'free';
  return expiresMs >= Date.now() ? 'premium' : 'free';
}

export async function getUsage(userKey, date = isoDate()) {
  const supabase = await getSupabase();
  if (!supabase) {
    const row = localStore.usage_daily[usageKey(userKey, date)] || { chat_count: 0, image_count: 0 };
    return { chat: row.chat_count || 0, image: row.image_count || 0 };
  }
  const { data, error } = await supabase
    .from('usage_daily')
    .select('chat_count,image_count')
    .eq('user_key', userKey)
    .eq('usage_date', date)
    .maybeSingle();
  if (error) {
    const row = localStore.usage_daily[usageKey(userKey, date)] || { chat_count: 0, image_count: 0 };
    return { chat: row.chat_count || 0, image: row.image_count || 0 };
  }
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
    const { error } = await supabase.from('usage_daily').upsert({
      user_key: userKey,
      usage_date: usageDate,
      chat_count: type === 'chat' ? current + amount : usage.chat,
      image_count: type === 'image' ? current + amount : usage.image
    }, { onConflict: 'user_key,usage_date' });
    if (error) {
      const key = usageKey(userKey, usageDate);
      const row = localStore.usage_daily[key] || { chat_count: 0, image_count: 0 };
      if (type === 'chat') row.chat_count += amount;
      else row.image_count += amount;
      localStore.usage_daily[key] = row;
      persistStore();
    }
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


export async function upsertUserProfile(user = {}) {
  const userKey = user?.email ? `email:${String(user.email).trim().toLowerCase()}` : (user?.id ? `id:${user.id}` : 'guest');
  const row = {
    user_key: userKey,
    id: user.id || '',
    name: user.name || '',
    email: user.email || '',
    picture: user.picture || '',
    updated_at: new Date().toISOString()
  };

  const supabase = await getSupabase();
  if (!supabase) {
    localStore.user_profiles[userKey] = row;
    persistStore();
    return row;
  }

  await supabase.from('user_profiles').upsert(row, { onConflict: 'user_key' });
  return row;
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
