import { consumeQuota, resolveUserKey, getQuotaSnapshot } from '../lib/db.js';

const MODEL_MAP = {
  openai: 'openai/gpt-4.1',
  gpt4o: 'openai/gpt-4.1',
  gemini: 'google/gemini-2.0-flash-001',
  claude: 'anthropic/claude-sonnet-4.5'
};

function buildSystemPrompt(thinkingMode) {
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'long'
  });
  return `Kamu adalah Youz AI, asisten virtual buatan Yuzz Ofc. Waktu sekarang: ${currentTime}. Jawab dalam Bahasa Indonesia yang santai dan informatif.${thinkingMode ? ' Gunakan reasoning mendalam sebelum menjawab.' : ''}`;
}

function normalizeModelType(modelType) {
  if (!modelType) return 'openai';
  return ['openai', 'gpt4o', 'gemini', 'claude'].includes(modelType) ? modelType : 'openai';
}

async function callRuneria({ apiKey, model, messages }) {
  const response = await fetch('https://runeria.fun/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, stream: false })
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, content: `Runeria error: ${data.error?.message || 'Unknown error'}` };
  }
  return {
    success: true,
    content: data.choices?.[0]?.message?.content || 'Tidak ada respons.',
    sources: []
  };
}

async function callOpenRouter({ apiKey, model, messages, enableSearch, maxTokens = 1000 }) {
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7
  };

  if (enableSearch) {
    if (model.includes('gemini')) {
      body.tools = [{ googleSearch: {} }];
    } else {
      body.plugins = [{ id: 'web', max_results: 5 }];
    }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
      'X-Title': 'Youz AI'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { success: false, content: 'Response tidak valid dari OpenRouter.' };
  }

  if (!response.ok) {
    return { success: false, content: `OpenRouter error: ${data.error?.message || 'Unknown error'}` };
  }

  const rawSources = data.citations || data.sources || data.choices?.[0]?.message?.citations || data.choices?.[0]?.message?.annotations || [];
  const sources = (Array.isArray(rawSources) ? rawSources : [])
    .map((source) => ({
      title: source.title || source.name || source.url || 'Sumber',
      url: source.url || source.link || source.uri || '',
      snippet: source.snippet || source.text || source.description || ''
    }))
    .filter((source) => source.url);

  return {
    success: true,
    content: data.choices?.[0]?.message?.content || 'Tidak ada respons.',
    sources
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    messages = [],
    action = 'chat',
    modelType: rawModelType = 'openai',
    imageData,
    prompt,
    enableSearch = false,
    thinkingMode = false,
    userContext = {}
  } = req.body || {};

  const userKey = resolveUserKey(req, userContext);
  const modelType = normalizeModelType(rawModelType);

  try {
    const quotaType = action === 'generate' ? 'image' : 'chat';
    const quota = await consumeQuota({ userKey, type: quotaType, amount: 1 });
    if (!quota.success) {
      const content = quotaType === 'image'
        ? `Limit harian image generate habis (${quota.limit}/hari). Upgrade Premium untuk 15 image/hari.`
        : `Limit harian obrolan habis (${quota.limit}/hari). Upgrade Premium untuk 120 chat/hari.`;
      return res.status(200).json({ success: false, content, limit: { type: quotaType, ...quota, ...(await getQuotaSnapshot(userKey)) } });
    }

    if (action === 'generate' && !imageData) {
      const imagePrompt = prompt || 'pemandangan indah';
      if (modelType === 'gemini' && process.env.GEMINI_API_KEY) {
        const imagenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instances: [{ prompt: imagePrompt }], parameters: { sampleCount: 1 } })
        });
        const imagenData = await imagenResponse.json();
        const imageBase64 = imagenData?.predictions?.[0]?.bytesBase64Encoded || imagenData?.predictions?.[0]?.image?.bytesBase64Encoded || '';
        if (!imagenResponse.ok || !imageBase64) {
          return res.status(200).json({ success: false, content: `Imagen error: ${imagenData.error?.message || 'Tidak bisa membuat gambar.'}` });
        }
        return res.status(200).json({ success: true, content: `Gambar berhasil dibuat untuk prompt: ${imagePrompt}`, imageUrl: `data:image/png;base64,${imageBase64}`, action: 'generate', model: 'image-generator', limit: await getQuotaSnapshot(userKey) });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(200).json({ success: false, content: 'OPENAI_API_KEY belum diatur untuk generate gambar.' });
      }
      
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: imagePrompt, size: '1024x1024' })
      });
      const openaiData = await openaiResponse.json();
      const imageBase64 = openaiData?.data?.[0]?.b64_json;
      if (!openaiResponse.ok || !imageBase64) {
        return res.status(200).json({ success: false, content: `OpenAI image error: ${openaiData.error?.message || 'Gagal generate gambar.'}` });
      }
      return res.status(200).json({ success: true, content: `Gambar berhasil dibuat untuk prompt: ${imagePrompt}`, imageUrl: `data:image/png;base64,${imageBase64}`, action: 'generate', model: 'image-generator', limit: await getQuotaSnapshot(userKey) });
    }

    const systemPrompt = buildSystemPrompt(thinkingMode);
    const chatMessages = action === 'generate' && imageData
      ? [{
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'Deskripsikan atau edit gambar ini.' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }]
      : [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)];

    const model = MODEL_MAP[modelType] || MODEL_MAP.openai;
    let providerResponse;

    if (modelType === 'claude') {
      const runeriaKey = process.env.RUNERIA_API_KEY;
      if (!runeriaKey) {
        return res.status(200).json({ success: false, content: 'RUNERIA_API_KEY belum dikonfigurasi.' });
      }
      providerResponse = await callRuneria({ apiKey: runeriaKey, model: 'claude-sonnet-4.5', messages: chatMessages });
    } else {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        return res.status(200).json({ success: false, content: 'OPENROUTER_API_KEY belum dikonfigurasi.' });
      }
      providerResponse = await callOpenRouter({
        apiKey: openRouterKey,
        model,
        messages: chatMessages,
        enableSearch: action === 'search' || Boolean(enableSearch),
        maxTokens: action === 'search' ? 1500 : 1000
      });
    }

    return res.status(200).json({
      success: providerResponse.success,
      content: providerResponse.content,
      model: action === 'generate' ? 'vision' : (action === 'search' ? 'web-search' : modelType),
      sources: providerResponse.sources || [],
      action,
      limit: await getQuotaSnapshot(userKey)
    });
  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan server: ${error.message}` });
  }
}
