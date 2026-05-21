import { resolveUserKey, getUserSettings, upsertUserSettings, readTable, confirmPremium, getQuotaSnapshot, pushNotification, listNotifications, markNotificationsRead } from '../lib/db.js';

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

  if (req.query?.scope === 'admin') {
    if (!isAdminUser(userKey)) {
      return res.status(403).json({ success: false, message: 'Akses admin ditolak.' });
    }

    try {
      if (req.method === 'GET') {
        const [premiumRequests, premiumUsers, chatHistory, usageRows] = await Promise.all([
          readTable('premium_requests', { columns: '*', limit: 200 }),
          readTable('premium_users', { columns: '*', limit: 2000 }),
          readTable('chat_history', { columns: '*', limit: 5000 }),
          readTable('usage_daily', { columns: '*', limit: 5000 })
        ]);

        const pendingRequests = (premiumRequests || []).filter((item) => String(item?.status || 'pending').toLowerCase() === 'pending');
        const activePremium = (premiumUsers || []).filter((item) => String(item?.status || 'active').toLowerCase() === 'active');

        return res.status(200).json({
          success: true,
          data: {
            overview: {
              pending_requests: pendingRequests.length,
              active_premium_users: activePremium.length,
              total_premium_requests: (premiumRequests || []).length,
              chat_messages_logged: (chatHistory || []).length,
              usage_rows: (usageRows || []).length
            },
            latest_premium_requests: (premiumRequests || []).slice(0, 50),
            premium_users: (premiumUsers || []).slice(0, 200),
            recent_chat_history: (chatHistory || []).slice(0, 50)
          }
        });
      }

      if (req.method === 'POST') {
        const action = String(req.body?.action || '').trim().toLowerCase();
        if (action === 'approve_premium') {
          const targetUserKey = String(req.body?.targetUserKey || '').trim();
          const months = Number(req.body?.months) || 1;
          if (!targetUserKey) return res.status(400).json({ success: false, message: 'targetUserKey wajib diisi.' });
          await confirmPremium({ userKey: targetUserKey, months, admin: extractEmailFromUserKey(userKey) || 'admin' });
          const quota = await getQuotaSnapshot(targetUserKey);
          return res.status(200).json({ success: true, message: 'Premium berhasil diaktifkan.', quota });
        }

        if (action === 'send_notification') {
          const target = String(req.body?.target || 'all').toLowerCase() === 'user' ? 'user' : 'all';
          const targetUserKey = String(req.body?.targetUserKey || '').trim();
          const title = String(req.body?.title || 'Notifikasi Admin').trim();
          const message = String(req.body?.message || '').trim();
          if (!message) return res.status(400).json({ success: false, message: 'Pesan notifikasi wajib diisi.' });
          const notif = await pushNotification({ admin: extractEmailFromUserKey(userKey) || 'admin', target, targetUserKey, title, message });
          return res.status(200).json({ success: true, message: 'Notifikasi terkirim.', notification: notif });
        }
        return res.status(400).json({ success: false, message: 'Action tidak dikenali.' });
      }

      return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error?.message || 'Gagal mengambil data admin.' });
    }
  }

  if (req.method === 'GET') {
    try {
      if (String(req.query?.scope || '') === 'notifications') {
        const notifications = await listNotifications(userKey, { onlyUnread: false });
        const unread_count = notifications.filter((row) => !(row?.read_by || []).includes(userKey)).length;
        return res.status(200).json({ success: true, notifications, unread_count });
      }
      const settings = await getUserSettings(userKey);
      return res.status(200).json({ success: true, settings: settings || null });
    } catch (error) {
      return res.status(200).json({ success: false, message: error?.message || 'Gagal memuat pengaturan.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { userContext: _ignored, action, ...payload } = req.body || {};
      if (String(action || '') === 'mark_notifications_read') {
        const marked = await markNotificationsRead(userKey, Array.isArray(req.body?.ids) ? req.body.ids : []);
        return res.status(200).json({ success: true, marked });
      }
      const settings = await upsertUserSettings(userKey, payload);
      return res.status(200).json({ success: true, settings });
    } catch (error) {
      return res.status(400).json({ success: false, message: error?.message || 'Invalid payload' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
