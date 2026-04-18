export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(200).json({ 
      success: false, 
      content: 'Gemini API Key tidak dikonfigurasi.' 
    });
  }

  const { imageData, prompt } = req.body;

  if (!imageData) {
    return res.status(200).json({ 
      success: false, 
      content: 'Tidak ada data gambar.' 
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
            { text: prompt || 'Deskripsikan gambar ini dalam Bahasa Indonesia.' },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
          ]
        }]
      })
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ 
        success: false, 
        content: 'Response dari Gemini Vision tidak valid.' 
      });
    }

    if (!response.ok) {
      return res.status(200).json({ 
        success: false, 
        content: `Vision Error: ${data.error?.message || 'Unknown error'}` 
      });
    }

    return res.status(200).json({ 
      success: true, 
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak dapat menganalisis gambar.'
    });

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      content: `Kesalahan: ${error.message}` 
    });
  }
}
