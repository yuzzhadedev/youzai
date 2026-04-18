export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
}
