export default function handler(req, res) {
  res.status(200).json({
    name: 'Youz AI',
    version: '1.0.0',
    author: 'Yuzz Ofc',
    endpoints: {
      health: '/api/health',
      openai: '/api/openai',
      gemini: '/api/gemini',
      vision: '/api/gemini-vision'
    }
  });
}
