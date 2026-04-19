export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ success: false, content: 'API Key tidak dikonfigurasi.' });

  const { messages, action, modelType, imageData, prompt } = req.body;
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });

  try {
    let requestBody;
    let systemPrompt = `Kamu adalah Youz AI, asisten virtual buatan Yuzz Ofc. Waktu sekarang: ${currentTime}. Jawab dalam Bahasa Indonesia yang santai dan informatif.`;

    // ========== WEB SEARCH MODE ==========
    if (action === 'search') {
      // Gunakan Gemini dengan Google Search Grounding (tersedia di OpenRouter)
      requestBody = {
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt + ' Kamu memiliki akses internet melalui Google Search. Gunakan untuk mencari informasi terkini dan akurat.' 
          },
          ...messages.slice(-5)
        ],
        max_tokens: 1500,
        temperature: 0.7,
        tools: [{ googleSearch: {} }] // Google Search Grounding
      };
    } 
    
    // ========== GENERATE/EDIT GAMBAR MODE ==========
    else if (action === 'generate' && imageData) {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o-mini',
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
    
    // ========== GENERATE DARI TEKS ==========
    else if (action === 'generate' && !imageData) {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt + ' Kamu adalah AI yang bisa membuat deskripsi detail untuk generate gambar.' },
          { role: 'user', content: `Buatkan deskripsi detail untuk generate gambar: ${prompt}. Berikan dalam Bahasa Indonesia.` }
        ],
        max_tokens: 500,
        temperature: 0.7
      };
    } 
    
    // ========== CHAT BIASA ==========
    else {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10)
        ],
        max_tokens: 1000,
        temperature: 0.7
      };
    }

    console.log(`📤 [Youz AI] Action: ${action}, Model: ${requestBody.model}`);

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
    return res.status(200).json({ success: true, content, action });

  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` });
  }
}
