export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    models: {
      default: 'openai/gpt-4o',
      search: 'perplexity/llama-3.1-sonar-small-128k-online',
      vision: 'openai/gpt-4o'
    },
    timestamp: new Date().toISOString()
  });
}
