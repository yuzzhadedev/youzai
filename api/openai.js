export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      success: false, 
      content: 'OpenAI API Key tidak dikonfigurasi' 
    });
  }

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
            content: 'Kamu adalah Youz AI, asisten AI buatan Yuzz Ofc. Jawab dalam Bahasa Indonesia yang santai dan informatif.' 
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    return res.status(200).json({ 
      success: true, 
      content: data.choices[0].message.content 
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Error: ${error.message}` 
    });
  }
}
