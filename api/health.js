export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    models: {
      default: 'google/gemini-2.0-flash-exp:free',
      search: 'perplexity/llama-3.1-sonar-small-128k-online',
      vision: 'google/gemini-2.0-flash-exp:free'
    },
    timestamp: new Date().toISOString()
  });
}
