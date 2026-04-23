export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    models: { chatgpt: 'openai/gpt-4.1', gemini: 'google/gemini-2.5-flash', search: 'perplexity/llama-3.1-sonar-small-128k-online' },
    timestamp: new Date().toISOString()
  });
}
