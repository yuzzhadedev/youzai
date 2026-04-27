export default function handler(req, res) {
  return res.status(200).json({
    name: 'Youz AI',
    version: '1.0.0',
    author: 'Yuzz Ofc',
    endpoints: {
      health: '/api/health',
      youz: '/api/youz.js'
    }
  });
}
