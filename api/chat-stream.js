import youzHandler from './youz.js';
import { saveConversationMessage, ensureConversation } from '../lib/db.js';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, prompt = '', userId = '', email = '' } = req.query || {};
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  const cid = await ensureConversation({ conversationId, userId, email, title: String(prompt).slice(0, 60) || 'New Chat' });
  await saveConversationMessage({ conversationId: cid, role: 'user', content: String(prompt) });

  let payload = null;
  const fakeRes = {
    status() { return this; },
    json(obj) { payload = obj; return obj; }
  };
  await youzHandler({ method: 'POST', body: { messages: [{ role: 'user', content: String(prompt) }], action: 'chat', userContext: { id: userId, email } }, headers: req.headers, socket: req.socket }, fakeRes);

  const text = String(payload?.content || '');
  let built = '';
  for (const ch of text) {
    built += ch;
    res.write(`data: ${JSON.stringify({ type: 'token', token: ch, content: built })}\n\n`);
    await wait(35);
  }

  await saveConversationMessage({ conversationId: cid, role: 'assistant', content: built });
  res.write(`data: ${JSON.stringify({ type: 'done', conversationId: cid })}\n\n`);
  res.end();
}
