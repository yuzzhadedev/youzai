export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ 
      success: false, 
      content: 'Gemini API Key tidak dikonfigurasi' 
    });
  }

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Deskripsikan gambar ini dalam Bahasa Indonesia.' },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
          ]
        }]
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
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' 
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Error: ${error.message}` 
    });
  }
}
