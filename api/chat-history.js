import { getConversationWithMessages } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { conversationId, userId, email } = req.query || {};
    const history = await getConversationWithMessages({ conversationId, userId, email });
    return res.status(200).json({ success: true, history, ts: Date.now() });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
