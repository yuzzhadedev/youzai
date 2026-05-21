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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
let supabaseClient = null;

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value).trim());
}

async function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase belum dikonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.');
  }
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

  const emailCandidates = extractEmailCandidates(candidates);
  try {
    const { data, error } = await supabase
      .from('premium_users')
      .select('*')
      .in('user_key', candidates)
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return data[0];
  } catch {}

  if (emailCandidates.length > 0) {
    try {
      const { data, error } = await supabase
        .from('premium_users')
        .select('*')
        .in('email', emailCandidates)
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) return data[0];
    } catch {}
  }

  try {
    const escapeFilterValue = (value = '') => String(value).replace(/,/g, '\\,');
    const userKeyFilter = candidates.map(escapeFilterValue).join(',');
    const emailFilter = emailCandidates.map(escapeFilterValue).join(',');
    const orFilters = [`user_key.in.(${userKeyFilter})`];
    if (emailFilter) orFilters.push(`email.in.(${emailFilter})`);
    const { data, error } = await supabase
      .from('premium_users')
      .select('*')
      .or(orFilters.join(','))
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return data[0];
  } catch {}

  return null;
}

export async function getUserPlan(userKey) {
  if (!userKey || String(userKey).startsWith('guest:')) return 'free';
  const row = await getPremiumRow(userKey);
  if (!row) return 'free';

  const status = String(row.status ?? 'active').trim().toLowerCase();
  const planName = String(row.plan_name || '').trim().toLowerCase();
  const isPremiumPlan = !planName || planName === 'premium' || planName.startsWith('premium');
  const isActiveStatus = !status || ['active', 'confirmed', 'paid', 'success'].includes(status);
  if (!isActiveStatus || !isPremiumPlan) return 'free';

  if (!row.expires_at) return 'premium';
  const expiresMs = Date.parse(row.expires_at);
  if (Number.isNaN(expiresMs)) return 'free';
  return expiresMs >= Date.now() ? 'premium' : 'free';
}

export async function getUsage(userKey, date = isoDate()) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('usage_daily')
    .select('chat_count,image_count')
    .eq('user_key', userKey)
    .eq('usage_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Gagal mengambil usage_daily');
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
  const { error } = await supabase.from('usage_daily').upsert({
    user_key: userKey,
    usage_date: usageDate,
    chat_count: type === 'chat' ? current + amount : usage.chat,
    image_count: type === 'image' ? current + amount : usage.image
  }, { onConflict: 'user_key,usage_date' });
  if (error) throw new Error(error.message || 'Gagal update quota');

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
  const { error } = await supabase.from('user_profiles').upsert(row, { onConflict: 'user_key' });
  if (error) throw new Error(error.message || 'Gagal simpan user profile');
  return row;
}

export async function findAuthUserByEmail(email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const supabase = await getSupabase();

  try {
    const { data, error } = await supabase
      .from('auth_users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!error && data) return data;
  } catch {}
  return null;
}

export async function saveAuthUser({ name, email, passwordHash, picture = '', provider = 'email' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('email wajib diisi');
  const row = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim() || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    picture: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail)}&background=3b82f6&color=fff`,
    password_hash: String(passwordHash || ''),
    provider: String(provider || 'email'),
    updated_at: new Date().toISOString()
  };

  const supabase = await getSupabase();
  const { error } = await supabase.from('auth_users').upsert(row, { onConflict: 'email' });
  if (error) throw new Error(error.message || 'Gagal simpan auth user');
  return row;
}

function normalizeUserSettings(input = {}) {
  const theme = ['light', 'dark', 'system'].includes(input?.theme) ? input.theme : undefined;
  const language = ['id', 'en'].includes(input?.language) ? input.language : undefined;
  const model = ['gemini', 'claude', 'gpt4o'].includes(input?.model) ? input.model : undefined;
  const webSearch = typeof input?.web_search_enabled === 'boolean' ? input.web_search_enabled : undefined;
  const thinking = typeof input?.thinking_enabled === 'boolean' ? input.thinking_enabled : undefined;

  const browserNotif = typeof input?.browser_notifications_enabled === 'boolean' ? input.browser_notifications_enabled : undefined;
  const soundNotif = typeof input?.sound_notifications_enabled === 'boolean' ? input.sound_notifications_enabled : undefined;
  const conversationBackup = Array.isArray(input?.conversation_backup) ? input.conversation_backup.slice(0, 50) : undefined;

  const out = {};
  if (theme !== undefined) out.theme = theme;
  if (language !== undefined) out.language = language;
  if (model !== undefined) out.model = model;
  if (webSearch !== undefined) out.web_search_enabled = webSearch;
  if (thinking !== undefined) out.thinking_enabled = thinking;
  if (browserNotif !== undefined) out.browser_notifications_enabled = browserNotif;
  if (soundNotif !== undefined) out.sound_notifications_enabled = soundNotif;
  if (conversationBackup !== undefined) out.conversation_backup = conversationBackup;
  return out;
}

export async function getUserSettings(userKey = '') {
  const key = String(userKey || '').trim();
  if (!key) return null;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_key', key)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Gagal mengambil user settings');
  return data || null;
}

export async function upsertUserSettings(userKey = '', nextSettings = {}) {
  const key = String(userKey || '').trim();
  if (!key) throw new Error('userKey wajib diisi');

  const normalized = normalizeUserSettings(nextSettings);
  const existing = (await getUserSettings(key)) || {};
  const merged = {
    user_key: key,
    theme: normalized.theme ?? existing.theme ?? 'system',
    language: normalized.language ?? existing.language ?? 'id',
    model: normalized.model ?? existing.model ?? 'gemini',
    web_search_enabled: normalized.web_search_enabled ?? existing.web_search_enabled ?? true,
    thinking_enabled: normalized.thinking_enabled ?? existing.thinking_enabled ?? false,
    browser_notifications_enabled: normalized.browser_notifications_enabled ?? existing.browser_notifications_enabled ?? false,
    sound_notifications_enabled: normalized.sound_notifications_enabled ?? existing.sound_notifications_enabled ?? false,
    conversation_backup: normalized.conversation_backup ?? existing.conversation_backup ?? [],
    updated_at: new Date().toISOString()
  };

  const supabase = await getSupabase();
  const { error } = await supabase.from('user_settings').upsert(merged, { onConflict: 'user_key' });
  if (error) throw new Error(error.message || 'Gagal simpan user settings');
  return merged;
}

export async function createPremiumRequest({ userKey, name, email, method, notes }) {
  const normalizedMethod = ['qris', 'dana', 'gopay'].includes(method) ? method : 'qris';
  const createdAt = new Date().toISOString();
  
  const supabase = await getSupabase();

  const { data, error } = await supabase
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

  if (error) throw new Error(error.message || 'Gagal membuat premium request');
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
  const { error } = await supabase.from('premium_users').upsert(row, { onConflict: 'user_key' });
  if (error) throw new Error(error.message || 'Gagal mengaktifkan premium');
}

export async function ensureConversation({ conversationId, userId = '', email = '', title = 'New Chat' }) {
  const supabase = await getSupabase();
  if (conversationId && isUuid(conversationId)) {
    const { data, error } = await supabase.from('conversations').select('id').eq('id', conversationId).maybeSingle();
    if (!error && data?.id) return data.id;
  }

  const owner = isUuid(userId) ? userId : null;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: owner, title })
    .select('id')
    .single();
  if (error) throw new Error(error.message || 'Gagal membuat conversation');
  return data.id;
}

export async function saveConversationMessage({ conversationId, role, content }) {
  const supabase = await getSupabase();
  if (!conversationId || !isUuid(conversationId)) return;
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    role,
    content
  });
  if (error) return;
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
}

export async function getConversationWithMessages({ conversationId, userId, email }) {
  const supabase = await getSupabase();

  let conversation = null;
  if (conversationId && isUuid(conversationId)) {
    const { data, error } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
    if (!error) conversation = data || null;
  } else if (userId && isUuid(userId)) {
    const { data, error } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!error) conversation = data || null;
  }

  if (!conversation) return { conversation: null, messages: [] };
  const { data: messages, error } = await supabase.from('messages').select('*').eq('conversation_id', conversation.id).order('created_at', { ascending: true });
  if (error) return { conversation, messages: [] };
  return { conversation, messages: messages || [] };
}


export async function listNotifications(userKey = '', { onlyUnread = false } = {}) {
  const key = String(userKey || '').trim();
  if (!key) return [];
  const supabase = await getSupabase();
  let query = supabase.from('notifications').select('*').or(`target.eq.all,target_user_key.eq.${key}`).order('created_at', { ascending: false }).limit(100);
  const { data, error } = await query;
  if (error) return [];
  const rows = Array.isArray(data) ? data : [];
  if (!onlyUnread) return rows;
  return rows.filter((row) => !Array.isArray(row?.read_by) || !row.read_by.includes(key));
}

export async function pushNotification({ admin = 'admin', target = 'all', targetUserKey = '', title = '', message = '' }) {
  const row = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target: target === 'user' ? 'user' : 'all',
    target_user_key: target === 'user' ? String(targetUserKey || '').trim() : null,
    title: String(title || '').trim() || 'Notifikasi Admin',
    message: String(message || '').trim(),
    created_by: admin,
    created_at: new Date().toISOString(),
    read_by: []
  };
  if (row.target === 'user' && !row.target_user_key) throw new Error('targetUserKey wajib untuk target user');

  const supabase = await getSupabase();
  const { error } = await supabase.from('notifications').insert(row);
  if (error) throw new Error(error.message || 'Gagal kirim notifikasi');
  return row;
}

export async function markNotificationsRead(userKey = '', ids = []) {
  const key = String(userKey || '').trim();
  if (!key) return 0;
  const idSet = new Set((ids || []).map((v) => String(v)));
  const supabase = await getSupabase();
  const targetIds = [...idSet];
  if (targetIds.length === 0) return 0;

  const { data: rows, error: fetchError } = await supabase
    .from('notifications')
    .select('id,read_by')
    .in('id', targetIds);
  if (fetchError) return 0;

  const updates = (Array.isArray(rows) ? rows : []).map((row) => {
    const rb = Array.isArray(row?.read_by) ? row.read_by : [];
    if (rb.includes(key)) return null;
    return { id: row.id, read_by: [...rb, key] };
  }).filter(Boolean);
  if (!updates.length) return 0;

  let updated = 0;
  for (const update of updates) {
    const { error } = await supabase.from('notifications').update({ read_by: update.read_by }).eq('id', update.id);
    if (!error) updated += 1;
  }
  return updated;
}
