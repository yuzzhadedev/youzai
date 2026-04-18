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

  const { messages } = req.body;

  try {
    // INI BAGIAN PENTING - URL harus OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://youzai.vercel.app',
        'X-Title': 'Youz AI'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free', // Model GRATIS
        messages: [
          { 
            role: 'system', 
            content: 'Kamu adalah Youz AI, buatan Yuzz Ofc. Jawab dalam Bahasa Indonesia.' 
          },
          ...messages
        ],
        max_tokens: 1000
      })
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ 
        success: false, 
        content: 'Response tidak valid dari OpenRouter.' 
      });
    }

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `Error: ${data.error?.message || 'Unknown'}` 
      });
    }

    return res.status(200).json({ 
      success: true, 
      content: data.choices?.[0]?.message?.content || 'Tidak ada respons.'
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan: ${error.message}` 
    });
  }
}
