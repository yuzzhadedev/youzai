export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    models: { chatgpt: 'openai/gpt-4.1', gemini: 'google/gemini-2.5-flash', search: 'openai/gpt-4o-search-preview' },
    timestamp: new Date().toISOString()
  });
}
