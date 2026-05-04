import { consumeQuota, resolveUserKey, getQuotaSnapshot, ensureConversation, saveConversationMessage, getConversationWithMessages } from '../lib/db.js';

const MODEL_MAP = {
  openai: 'openai/gpt-4.1',
  gpt4o: 'openai/gpt-4.1',
  gemini: 'google/gemini-2.0-flash-001',
  claude: 'anthropic/claude-sonnet-4.5'
};

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function buildSystemPrompt(thinkingMode, userContext = {}) {
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });
  const rawName = String(userContext?.name || userContext?.fullName || userContext?.username || '').trim();
  const userName = rawName ? rawName.replace(/\s+/g, ' ').slice(0, 60) : '';
  const nameContext = userName ? ` Nama pengguna saat ini: ${userName}. Jika relevan, sapa namanya secara natural.` : '';
  return `Kamu adalah Youz AI, asisten virtual buatan Yuzz Ofc. Waktu sekarang: ${currentTime}.${nameContext} Jawab dalam Bahasa Indonesia yang santai dan informatif.${thinkingMode ? ' Gunakan reasoning mendalam sebelum menjawab.' : ''}`;
}

function normalizeModelType(modelType) {
  if (!modelType) return 'openai';
  return ['openai', 'gpt4o', 'gemini', 'claude'].includes(modelType) ? modelType : 'gemini';
}

async function callRuneria({ apiKey, model, messages }) { /* unchanged */
  const response = await fetch('https://runeria.fun/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false }) });
  const data = await response.json();
  if (!response.ok) return { success: false, content: `Runeria error: ${data.error?.message || 'Unknown error'}` };
  return { success: true, content: data.choices?.[0]?.message?.content || 'Tidak ada respons.', sources: [] };
}

async function callOpenRouter({ apiKey, model, messages, enableSearch, maxTokens = 1000 }) {
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.7 };
  if (enableSearch) {
    if (model.includes('gemini')) body.tools = [{ googleSearch: {} }];
    else body.plugins = [{ id: 'web', max_results: 5 }];
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://youzai.my.id', 'X-Title': 'Youz AI' }, body: JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { return { success: false, content: 'Response tidak valid dari OpenRouter.' }; }
  if (!response.ok) return { success: false, content: `OpenRouter error: ${data.error?.message || 'Unknown error'}` };
  const rawSources = data.citations || data.sources || data.choices?.[0]?.message?.citations || data.choices?.[0]?.message?.annotations || [];
  const sources = (Array.isArray(rawSources) ? rawSources : []).map((source) => ({ title: source.title || source.name || source.url || 'Sumber', url: source.url || source.link || source.uri || '', snippet: source.snippet || source.text || source.description || '' })).filter((source) => source.url);
  return { success: true, content: data.choices?.[0]?.message?.content || 'Tidak ada respons.', sources };
}

async function processChatRequest(req, payload = {}) {
  const { messages = [], action = 'chat', modelType: rawModelType = 'openai', imageData, prompt, enableSearch = false, thinkingMode = false, userContext = {} } = payload;
  const userKey = resolveUserKey(req, userContext);
  const modelType = normalizeModelType(rawModelType);

  const quotaType = action === 'generate' ? 'image' : 'chat';
  const quotaSnapshot = await getQuotaSnapshot(userKey);
  if (modelType === 'gpt4o' && quotaSnapshot?.plan !== 'premium') return { success: false, content: 'Model ChatGPT 4o hanya untuk pengguna Premium.', limit: { type: quotaType, ...quotaSnapshot } };
  const currentUsage = quotaSnapshot?.usage?.[quotaType] || 0;
  const limitAmount = quotaSnapshot?.limits?.[quotaType] || 0;
  if (currentUsage >= limitAmount) {
    const content = quotaType === 'image' ? `Limit harian image generate habis (${limitAmount}/hari). Upgrade Premium untuk 15 image/hari.` : `Limit harian obrolan habis (${limitAmount}/hari). Upgrade Premium untuk 120 chat/hari.`;
    return { success: false, content, limit: { type: quotaType, ...quotaSnapshot } };
  }

  if (action === 'generate' && !imageData) return { success: false, content: 'Generate image tidak didukung pada endpoint gabungan ini.' };

  const systemPrompt = buildSystemPrompt(thinkingMode, userContext);
  const chatMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)];
  const model = MODEL_MAP[modelType] || MODEL_MAP.openai;
  let providerResponse;
  if (modelType === 'claude') {
    const runeriaKey = process.env.RUNERIA_API_KEY;
    if (!runeriaKey) return { success: false, content: 'RUNERIA_API_KEY belum dikonfigurasi.' };
    providerResponse = await callRuneria({ apiKey: runeriaKey, model: 'claude-sonnet-4.5', messages: chatMessages });
  } else {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return { success: false, content: 'OPENROUTER_API_KEY belum dikonfigurasi.' };
    providerResponse = await callOpenRouter({ apiKey: openRouterKey, model, messages: chatMessages, enableSearch: action === 'search' || Boolean(enableSearch), maxTokens: action === 'search' ? 1500 : 1000 });
  }
  if (providerResponse.success) await consumeQuota({ userKey, type: 'chat', amount: 1 });
  return {
    success: providerResponse.success,
    content: providerResponse.content,
    model: action === 'generate' ? 'vision' : (action === 'search' ? 'web-search' : modelType),
    hasSearch: action === 'search' || Boolean(enableSearch) || (providerResponse.sources || []).length > 0,
    sources: providerResponse.sources || [],
    action,
    limit: await getQuotaSnapshot(userKey)
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const mode = String(req.query?.mode || '').toLowerCase();
    if (mode === 'history') {
      const { conversationId, userId, email } = req.query || {};
      const history = await getConversationWithMessages({ conversationId, userId, email });
      return res.status(200).json({ success: true, history, ts: Date.now() });
    }
    if (mode === 'stream') {
      const { conversationId, prompt = '', userId = '', email = '' } = req.query || {};
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      const cid = await ensureConversation({ conversationId, userId, email, title: String(prompt).slice(0, 60) || 'New Chat' });
      await saveConversationMessage({ conversationId: cid, role: 'user', content: String(prompt) });
      const response = await processChatRequest(req, { messages: [{ role: 'user', content: String(prompt) }], action: 'chat', userContext: { id: userId, email } });
      const text = String(response?.content || '');
      let built = '';
      for (const ch of text) { built += ch; res.write(`data: ${JSON.stringify({ type: 'token', token: ch, content: built })}\n\n`); await wait(35); }
      await saveConversationMessage({ conversationId: cid, role: 'assistant', content: built });
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId: cid })}\n\n`);
      return res.end();
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const response = await processChatRequest(req, req.body || {});
    return res.status(200).json(response);
  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan server: ${error.message}` });
  }
}
