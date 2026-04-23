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
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4.1',
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
      // Gunakan Pollinations.ai untuk generate gambar (GRATIS)
      const imagePrompt = prompt || 'pemandangan indah';
      const encodedPrompt = encodeURIComponent(imagePrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
      
      // Dapatkan deskripsi dari AI
      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
          'X-Title': 'Youz AI'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Buatkan deskripsi singkat tentang: ${imagePrompt}` }
          ],
          max_tokens: 200
        })
      });
      
      const aiData = await aiResponse.json();
      const description = aiData.choices?.[0]?.message?.content || `Gambar: ${imagePrompt}`;
      
      return res.status(200).json({ 
        success: true, 
        content: description,
        imageUrl: imageUrl,
        action: 'generate'
      });
    } 
    
    // ========== CHAT BIASA ==========
    else {
      requestBody = {
        model: modelType === 'gemini' ? 'google/gemini-2.5-flash' : 'openai/gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10)
        ],
        max_tokens: 1000,
        temperature: 0.7
      };
    }

    console.log(`📤 [Youz AI] Action: ${action}, Model: ${requestBody?.model || 'pollinations'}`);

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
    return res.status(200).json({ success: true, content, action });

  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` });
  }
}
