import { readTable, resolveUserKey } from '../lib/db.js';

const ADMIN_EMAIL = 'mutustorereal@gmail.com';

function extractEmailFromUserKey(userKey = '') {
  const value = String(userKey || '').toLowerCase();
  if (value.startsWith('email:')) return value.slice(6);
  return value.includes('@') ? value : '';
}

function isAdminRequest(req) {
  const userContext = req.method === 'POST' ? req.body?.userContext : req.query;
  const userKey = resolveUserKey(req, userContext || {});
  const email = extractEmailFromUserKey(userKey);
  return email === ADMIN_EMAIL;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAdminRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses admin ditolak.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const [premiumRequests, premiumUsers, chatHistory] = await Promise.all([
      readTable('premium_requests', { columns: '*', limit: 10 }),
      readTable('premium_users', { columns: '*', limit: 1000 }),
      readTable('chat_history', { columns: '*', limit: 1000 })
    ]);

    const pendingRequests = (premiumRequests || []).filter((item) => String(item?.status || '').toLowerCase() === 'pending').length;
    const activePremium = (premiumUsers || []).filter((item) => String(item?.status || 'active').toLowerCase() === 'active').length;
    const totalMessages = (chatHistory || []).length;

    return res.status(200).json({
      success: true,
      data: {
        pending_requests: pendingRequests,
        active_premium_users: activePremium,
        chat_messages_logged: totalMessages,
        latest_premium_requests: (premiumRequests || []).slice(0, 10)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Gagal mengambil data admin.' });
  }
}
