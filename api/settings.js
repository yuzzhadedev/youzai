import { resolveUserKey, getUserSettings, upsertUserSettings, readTable } from '../lib/db.js';

const ADMIN_EMAIL = 'mutustorereal@gmail.com';

function extractEmailFromUserKey(userKey = '') {
  const value = String(userKey || '').toLowerCase();
  if (value.startsWith('email:')) return value.slice(6);
  return value.includes('@') ? value : '';
}

function isAdminUser(userKey = '') {
  return extractEmailFromUserKey(userKey) === ADMIN_EMAIL;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userContext = req.method === 'POST' ? req.body?.userContext : req.query;
  const userKey = resolveUserKey(req, userContext || {});


  if (req.method === 'GET' && req.query?.scope === 'admin') {
    if (!isAdminUser(userKey)) {
      return res.status(403).json({ success: false, message: 'Akses admin ditolak.' });
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

  if (req.method === 'GET') {
    const settings = await getUserSettings(userKey);
    return res.status(200).json({ success: true, settings: settings || null });
  }

  if (req.method === 'POST') {
    try {
      const { userContext: _ignored, ...payload } = req.body || {};
      const settings = await upsertUserSettings(userKey, payload);
      return res.status(200).json({ success: true, settings });
    } catch (error) {
      return res.status(400).json({ success: false, message: error?.message || 'Invalid payload' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

