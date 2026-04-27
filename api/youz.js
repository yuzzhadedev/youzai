import { consumeQuota, resolveUserKey, getQuotaSnapshot } from './_db.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ success: false, content: 'API Key tidak dikonfigurasi.' });

  const { messages, action, modelType, imageData, prompt } = req.body;
  const userContext = req.body?.userContext || {};
  const userKey = resolveUserKey(req, userContext);
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });

  try {
    const quotaType = action === 'generate' ? 'image' : 'chat';
    const quota = consumeQuota({ userKey, type: quotaType, amount: 1 });
    if (!quota.success) {
      const content = quotaType === 'image'
        ? `Limit harian image generate habis (${quota.limit}/hari). Upgrade Premium untuk 15 image/hari.`
        : `Limit harian obrolan habis (${quota.limit}/hari). Upgrade Premium untuk 120 chat/hari.`;
      return res.status(200).json({ success: false, content, limit: { type: quotaType, ...quota, ...getQuotaSnapshot(userKey) } });
    }
    let requestBody;
    let systemPrompt = `Kamu adalah Youz AI, asisten virtual buatan Yuzz Ofc. Waktu sekarang: ${currentTime}. Jawab dalam Bahasa Indonesia yang santai dan informatif.`;

    // ========== WEB SEARCH MODE - PASTI BERFUNGSI ==========
    if (action === 'search') {
      // Gunakan model yang support web search via plugin
      requestBody = {
        model: 'openai/gpt-4.1', // Bisa diganti dengan model lain
        messages: [
          { 
            role: 'system', 
            content: systemPrompt + ' Gunakan web search untuk mencari informasi real-time. Berikan jawaban berdasarkan hasil pencarian.' 
          },
          ...messages.slice(-5)
        ],
        max_tokens: 1500,
        temperature: 0.7,
        plugins: [{ id: 'web', max_results: 3 }] // Plugin web search
      };
    } 
    
    // ========== ALTERNATIF: MODEL KHUSUS SEARCH ==========
    // Jika plugins tidak berfungsi, gunakan model ini:
    // model: 'perplexity/llama-3.1-sonar-small-128k-online'
    // Model ini MEMILIKI akses internet bawaan tanpa plugin
    
    // ========== GENERATE/EDIT GAMBAR MODE ==========
    else if (action === 'generate' && imageData) {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.0-flash-001' : 'openai/gpt-4.1',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'Deskripsikan atau berikan instruksi edit untuk gambar ini.' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }],
        max_tokens: 800,
        temperature: 0.7
      };
    } 
    
    // ========== GENERATE GAMBAR DARI TEKS ==========
    else if (action === 'generate' && !imageData) {
      const imagePrompt = prompt || 'pemandangan indah';
      if (modelType === 'gemini' && process.env.GEMINI_API_KEY) {
        const imagenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: { sampleCount: 1 }
          })
        });
        const imagenData = await imagenResponse.json();
        const prediction = imagenData?.predictions?.[0] || {};
        const imageBase64 = prediction?.bytesBase64Encoded || prediction?.image?.bytesBase64Encoded || '';
        if (!imagenResponse.ok || !imageBase64) {
          return res.status(200).json({ success: false, content: `Imagen error: ${imagenData.error?.message || 'Tidak bisa membuat gambar.'}` });
        }
        const imageUrl = `data:image/png;base64,${imageBase64}`;
        return res.status(200).json({
          success: true,
          content: `Gambar berhasil dibuat dengan Imagen untuk prompt: ${imagePrompt}`,
          imageUrl,
          action: 'generate',
          limit: getQuotaSnapshot(userKey)
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(200).json({
          success: false,
          content: 'OPENAI_API_KEY belum diatur untuk generate gambar ChatGPT. Gunakan model Gemini atau set API key.'
        });
      }
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: imagePrompt,
          size: '1024x1024'
        })
      });
      const openaiData = await openaiResponse.json();
      if (!openaiResponse.ok) {
        return res.status(200).json({ success: false, content: `OpenAI image error: ${openaiData.error?.message || 'Gagal generate gambar.'}` });
      }
      const imageBase64 = openaiData.data?.[0]?.b64_json;
      if (!imageBase64) {
        return res.status(200).json({ success: false, content: 'OpenAI tidak mengembalikan gambar.' });
      }
      return res.status(200).json({
        success: true,
        content: `Gambar berhasil dibuat untuk prompt: ${imagePrompt}`,
        imageUrl: `data:image/png;base64,${imageBase64}`,
        action: 'generate',
        limit: getQuotaSnapshot(userKey)
      });
    } 
    
    // ========== CHAT BIASA ==========
    else {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.0-flash-001' : 'openai/gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10)
        ],
        max_tokens: 1000,
        temperature: 0.7
      };
    }

    console.log(`📤 [Youz AI] Action: ${action}, Model: ${requestBody?.model || modelType}`);

    // Jika sudah return dari generate, skip fetch OpenRouter
    if (action === 'generate' && !imageData) {
      return; // Sudah return di atas
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
        'X-Title': 'Youz AI'
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { 
      return res.status(200).json({ success: false, content: 'Response tidak valid.' }); 
    }
    
    if (!response.ok) {
      return res.status(200).json({ success: false, content: `Error: ${data.error?.message || 'Unknown'}` });
    }

    const content = data.choices?.[0]?.message?.content || 'Tidak ada respons.';
    return res.status(200).json({ success: true, content, action, limit: getQuotaSnapshot(userKey) });

  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` });
  }
}
