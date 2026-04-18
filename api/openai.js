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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://youz-ai.vercel.app',
        'X-Title': 'Youz AI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-2024-11-20',
        messages: [
          { 
            role: 'system', 
            content: 'Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Jawab dalam Bahasa Indonesia yang santai dan informatif.' 
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ 
        success: false, 
        content: 'Response dari OpenRouter tidak valid.' 
      });
    }

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `OpenRouter Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    return res.status(200).json({ 
      success: true, 
      content: data.choices?.[0]?.message?.content || 'Tidak ada respons.',
      model: 'openrouter'
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan: ${error.message}` 
    });
  }
}
