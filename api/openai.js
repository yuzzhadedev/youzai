export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ success: false, content: 'OpenRouter API Key tidak dikonfigurasi.' });

  const { messages, imageData, prompt, enableSearch, modelType = 'openai' } = req.body;
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });

  try {
    let requestBody;
    if (imageData) {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4.1',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt || 'Deskripsikan atau edit gambar ini.' }, { type: 'image_url', image_url: { url: imageData } }] }],
        max_tokens: 800, temperature: 0.7
      };
    } else {
      const limitedMessages = messages.slice(-10);
      let systemPrompt, model;
      if (modelType === 'gemini') {
        model = 'google/gemini-2.5-flash';
        systemPrompt = `Kamu adalah Youz AI (Yuzz Ofc). Gunakan Google Gemini 2.5 Flash. Waktu: ${currentTime}. Jawab dalam Bahasa Indonesia.`;
      } else {
        model = enableSearch ? 'openai/gpt-4.1' : 'google/gemini-2.5-flash';
        systemPrompt = `Kamu adalah Youz AI (Yuzz Ofc). Waktu: ${currentTime}. Jawab dalam Bahasa Indonesia.`;
      }
      requestBody = { model, messages: [{ role: 'system', content: systemPrompt }, ...limitedMessages], max_tokens: enableSearch ? 1500 : 1000, temperature: 0.7 };
      if (modelType === 'gemini' && enableSearch) requestBody.tools = [{ googleSearch: {} }];
      if (modelType !== 'gemini' && enableSearch) requestBody.plugins = [{ id: 'web', max_results: 5 }];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000', 'X-Title': 'Youz AI' },
      body: JSON.stringify(requestBody)
    });
    const text = await response.text(); let data;
    try { data = JSON.parse(text); } catch { return res.status(200).json({ success: false, content: 'Response tidak valid.' }); }
    if (!response.ok) {
      if (data.error?.code === 402) return res.status(200).json({ success: false, content: '💰 Kredit OpenRouter habis.' });
      return res.status(200).json({ success: false, content: `❌ Error: ${data.error?.message || 'Unknown'}` });
    }
    const content = data.choices?.[0]?.message?.content || 'Tidak ada respons.';
    let modelLabel = modelType === 'gemini' ? 'gemini' : 'chatgpt';
    if (enableSearch) modelLabel = 'web-search'; else if (imageData) modelLabel = 'vision';
    return res.status(200).json({ success: true, content, model: modelLabel });
  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan server: ${error.message}` });
  }
}
