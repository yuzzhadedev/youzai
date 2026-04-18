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
      // Vision Mode - Gunakan Gemini Flash (gratis & support vision)
      requestBody = {
        model: 'openai/gpt-4o',
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
      // Text Mode
      const limitedMessages = messages.slice(-10); // Batasi 10 pesan terakhir
      
      let systemPrompt;
      let model;
      
      if (enableSearch) {
        // Web Search Mode - Gunakan Perplexity Online (gratis)
        model = 'perplexity/llama-3.1-sonar-small-128k-online';
        systemPrompt = `Kamu adalah Youz AI, asisten virtual dengan akses internet real-time. Kamu dibuat oleh Developer Yuzz Ofc.

Informasi waktu saat ini:
- Waktu lokal (Jakarta/WIB): ${currentTime}
- Hari/Tanggal: ${currentDate}

Gunakan informasi waktu ini untuk konteks. Berikan jawaban yang akurat, terkini, dan informatif dalam Bahasa Indonesia. Jika mencari berita atau informasi terbaru, gunakan akses internet untuk mendapatkan data real-time. Sertakan sumber informasi jika memungkinkan.`;
      } else {
        // Mode Biasa - Gunakan Gemini Flash (gratis)
        model = 'google/gemini-2.0-flash-exp:free';
        systemPrompt = `Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc.

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

      // Aktifkan plugin web search untuk model Perplexity
      if (enableSearch) {
        requestBody.plugins = [{ 
          id: 'web', 
          max_results: 5,
          search_prompt: 'Cari informasi terbaru dan akurat tentang:'
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
      
      // Cek token limit error
      if (data.error?.message?.includes('token') || data.error?.message?.includes('exceeded')) {
        return res.status(200).json({ 
          success: false, 
          content: '⚠️ Percakapan terlalu panjang. Silakan mulai percakapan baru atau hapus beberapa pesan.' 
        });
      }
      
      // Cek kredit habis
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

    return res.status(200).json({ 
      success: true, 
      content: content,
      model: enableSearch ? 'web-search' : (imageData ? 'vision' : 'gemini')
    });

  } catch (error) {
    console.error('❌ Server Error:', error.message);
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan server: ${error.message}` 
    });
  }
}
