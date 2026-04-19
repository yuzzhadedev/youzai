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
    let systemPrompt = `Kamu adalah Youz AI, asisten virtual buatan Yuzz Ofc. Waktu: ${currentTime}. Jawab dalam Bahasa Indonesia.`;

    // ========== TENTUKAN ACTION ==========
    if (action === 'search') {
        // Web Search Mode
        systemPrompt += ' Gunakan akses internet untuk mencari informasi real-time.';
        requestBody = {
            model: 'openai/gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-5)],
            max_tokens: 1000,
            temperature: 0.7,
            plugins: [{ id: 'web', max_results: 3 }]
        };
    } else if (action === 'generate' && imageData) {
        // Generate/Edit Gambar Mode
        systemPrompt += ' Kamu adalah AI multimodal yang bisa menganalisis dan memberikan instruksi edit gambar.';
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
    } else if (action === 'generate' && !imageData) {
        // Generate Gambar dari teks (text-to-image)
        systemPrompt += ' Kamu bisa memberikan deskripsi detail untuk generate gambar.';
        requestBody = {
            model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Buatkan deskripsi detail untuk generate gambar: ${prompt}` }
            ],
            max_tokens: 500,
            temperature: 0.7
        };
    } else {
        // Chat Biasa
        requestBody = {
            model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)],
            max_tokens: 1000,
            temperature: 0.7
        };
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
    try { data = JSON.parse(text); } catch { return res.status(200).json({ success: false, content: 'Response tidak valid.' }); }
    
    if (!response.ok) {
        return res.status(200).json({ success: false, content: `Error: ${data.error?.message || 'Unknown'}` });
    }

    const content = data.choices?.[0]?.message?.content || 'Tidak ada respons.';
    return res.status(200).json({ success: true, content, action });

  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` });
  }
      }
