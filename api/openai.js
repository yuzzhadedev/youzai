export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return res.status(200).json({ 
      success: false, 
      content: 'OpenRouter API Key tidak dikonfigurasi.' 
    });
  }

  const { messages, imageData, prompt, enableSearch } = req.body;

  // System prompt dengan informasi waktu
  const now = new Date();
  const currentTime = now.toLocaleString('id-ID', { 
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full', 
    timeStyle: 'long' 
  });
  const currentDate = now.toLocaleDateString('id-ID', { 
    timeZone: 'Asia/Jakarta',
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  try {
    let requestBody;

    if (imageData) {
      // Vision Mode - Gunakan GPT-4o Mini (lebih hemat untuk vision)
      requestBody = {
        model: 'openai/gpt-4o-mini', // ChatGPT Vision
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'Deskripsikan gambar ini secara detail dalam Bahasa Indonesia.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      };
    } else {
      // Text Mode - Batasi 10 pesan terakhir untuk menghemat token
      const limitedMessages = messages.slice(-10);
      
      let systemPrompt;
      let model;
      
      if (enableSearch) {
        // Web Search Mode - Gunakan GPT-4o Search Preview
        model = 'openai/gpt-4o-search-preview';
        systemPrompt = `Kamu adalah Youz AI, asisten virtual dengan akses internet real-time. Kamu dibuat oleh Developer Yuzz Ofc.

Informasi waktu saat ini:
- Waktu lokal (Jakarta/WIB): ${currentTime}
- Hari/Tanggal: ${currentDate}

Gunakan informasi waktu ini untuk konteks. Berikan jawaban yang akurat, terkini, dan informatif dalam Bahasa Indonesia. Gunakan akses internet untuk mendapatkan data real-time. Sertakan sumber informasi jika memungkinkan.`;
      } else {
        // Mode Biasa - Gunakan GPT-4o Mini (paling hemat)
        model = 'openai/gpt-4o-mini';
        systemPrompt = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Kamu menggunakan model ChatGPT dari OpenAI.

Informasi waktu saat ini:
- Waktu lokal (Jakarta/WIB): ${currentTime}
- Hari/Tanggal: ${currentDate}

Gunakan informasi waktu ini jika pengguna bertanya tentang waktu, tanggal, atau hal yang berkaitan dengan waktu saat ini. Jawab dalam Bahasa Indonesia yang santai dan informatif.`;
      }
      
      requestBody = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...limitedMessages
        ],
        max_tokens: enableSearch ? 1500 : 1000,
        temperature: 0.7
      };

      // Aktifkan web search untuk model yang support
      if (enableSearch) {
        requestBody.plugins = [{ 
          id: 'web', 
          max_results: 5 
        }];
      }
    }

    console.log(`📤 [OpenRouter] Model: ${requestBody.model}, Search: ${enableSearch || false}`);

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
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', text.substring(0, 200));
      return res.status(200).json({ 
        success: false, 
        content: 'Response dari OpenRouter tidak valid.' 
      });
    }

    if (!response.ok) {
      console.error('❌ OpenRouter Error:', data.error);
      
      if (data.error?.message?.includes('token') || data.error?.message?.includes('exceeded')) {
        return res.status(200).json({ 
          success: false, 
          content: '⚠️ Percakapan terlalu panjang. Silakan mulai percakapan baru.' 
        });
      }
      
      if (data.error?.code === 402) {
        return res.status(200).json({ 
          success: false, 
          content: '💰 Kredit OpenRouter tidak mencukupi. Silakan isi ulang di https://openrouter.ai/credits' 
        });
      }
      
      return res.status(200).json({ 
        success: false, 
        content: `❌ OpenRouter Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    const content = data.choices?.[0]?.message?.content || 'Tidak ada respons.';
    
    console.log(`✅ [OpenRouter] Response diterima (${content.length} karakter)`);

    // Tentukan model label untuk frontend
    let modelLabel = 'chatgpt';
    if (imageData) modelLabel = 'vision';
    else if (enableSearch) modelLabel = 'web-search';

    return res.status(200).json({ 
      success: true, 
      content: content,
      model: modelLabel
    });

  } catch (error) {
    console.error('❌ Server Error:', error.message);
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan server: ${error.message}` 
    });
  }
}
