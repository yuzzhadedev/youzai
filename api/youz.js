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
      const imagePrompt = prompt || 'pemandangan indah';
      if (modelType === 'gemini' && process.env.GEMINI_API_KEY) {
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Buat satu gambar dengan prompt berikut: ${imagePrompt}` }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
          })
        });
        const geminiData = await geminiResponse.json();
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((part) => part.inlineData?.mimeType?.startsWith('image/'));
        const textPart = parts.find((part) => part.text);
        if (!geminiResponse.ok || !imagePart?.inlineData?.data) {
          return res.status(200).json({ success: false, content: `Gemini image error: ${geminiData.error?.message || 'Tidak bisa membuat gambar.'}` });
        }
        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        return res.status(200).json({
          success: true,
          content: textPart?.text || `Gambar berhasil dibuat untuk prompt: ${imagePrompt}`,
          imageUrl,
          action: 'generate'
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
    return res.status(200).json({ success: true, content, action });

  } catch (error) {
    return res.status(200).json({ success: false, content: `Kesalahan: ${error.message}` });
  }
}
