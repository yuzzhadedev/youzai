export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(200).json({ 
      success: false, 
      content: 'OpenAI API Key tidak dikonfigurasi.' 
    });
  }

  const { messages } = req.body;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'Kamu adalah Youz AI, asisten virtual yang cerdas, ramah, dan membantu. Kamu dibuat oleh Developer Yuzz Ofc. Kamu selalu menjawab dengan gaya yang santai tapi informatif, menggunakan Bahasa Indonesia yang baik dan benar.' 
          },
          ...messages
        ],
        max_tokens: 2000,
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
        content: 'Response dari OpenAI tidak valid.' 
      });
    }

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `OpenAI Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    return res.status(200).json({ 
      success: true, 
      content: data.choices?.[0]?.message?.content || 'Tidak ada respons.',
      model: 'openai'
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan: ${error.message}` 
    });
  }
}
