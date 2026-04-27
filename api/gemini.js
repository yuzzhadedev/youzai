import { consumeQuota, resolveUserKey, getQuotaSnapshot } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return res.status(200).json({ success: false, content: 'Gemini API Key tidak dikonfigurasi.' });
  }

  const { messages, userContext = {} } = req.body;
  const userKey = resolveUserKey(req, userContext);

  try {
    const quota = consumeQuota({ userKey, type: 'chat', amount: 1 });
    if (!quota.success) {
      return res.status(200).json({
        success: false,
        content: `Limit harian obrolan habis (${quota.limit}/hari). Upgrade Premium untuk 120 chat & 15 image/hari.`,
        limit: { type: 'chat', ...quota, ...getQuotaSnapshot(userKey) }
      });
    }
    
    let prompt = 'Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Jawab dalam Bahasa Indonesia yang baik dan benar.\n\n';
    for (const msg of messages) {
      if (msg.role === 'user') prompt += `User: ${msg.content}\n`;
      if (msg.role === 'assistant') prompt += `Youz AI: ${msg.content}\n`;
    }
    prompt += 'Youz AI: ';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
      })
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ success: false, content: 'Response dari Gemini tidak valid.' });
    }

    if (!response.ok) {
      return res.status(200).json({ success: false, content: `Gemini Error: ${data.error?.message || 'Unknown error'}` });
    }

    return res.status(200).json({
      success: true,
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons.',
      model: 'gemini',
      limit: getQuotaSnapshot(userKey)
    });
  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` }); 
  }
}
