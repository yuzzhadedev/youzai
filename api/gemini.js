export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ 
      success: false, 
      content: 'Gemini API Key tidak dikonfigurasi' 
    });
  }

  try {
    let prompt = 'Kamu adalah Youz AI, asisten AI buatan Yuzz Ofc. Jawab dalam Bahasa Indonesia.\n\n';
    
    messages.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Youz AI: ${msg.content}\n`;
      }
    });
    prompt += 'Youz AI: ';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    return res.status(200).json({ 
      success: true, 
      content: content 
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Error: ${error.message}` 
    });
  }
}
