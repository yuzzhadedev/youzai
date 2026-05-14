import { getQuotaSnapshot, readTable, resolveUserKey } from '../../lib/db.js';

function formatDate(value) {
  const d = new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default async function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)youz_user=([^;]+)/);
  const scope = String(req.query?.scope || '').trim().toLowerCase();

  if (!match) {
    if (scope === 'admin-overview') {
      return res.status(200).json({
        success: true,
        admin: { name: 'Admin', email: '', role: 'admin', plan: 'free' },
        stats: { totalUsers: 0, premiumUsers: 0, messagesToday: 0, revenue: 0 },
        recentUsers: [],
        allUsers: []
      });
    }
    return res.status(200).json({ authenticated: false, user: null });
  }

  try {
    const user = JSON.parse(decodeURIComponent(match[1]));
    const userKey = resolveUserKey(req, user || {});
    const quota = await getQuotaSnapshot(userKey);

    if (scope === 'admin-overview') {
      const profiles = await readTable('user_profiles');
      const premiumRows = await readTable('premium_users');
      const usageRows = await readTable('usage_daily');
      const notifications = await readTable('notifications');
      const premiumRequests = await readTable('premium_requests');

      const profileList = Array.isArray(profiles) ? profiles : Object.values(profiles || {});
      const premiumList = Array.isArray(premiumRows) ? premiumRows : Object.values(premiumRows || {});
      const usageList = Array.isArray(usageRows) ? usageRows : Object.values(usageRows || {});
      const notificationList = Array.isArray(notifications) ? notifications : Object.values(notifications || {});
      const premiumRequestList = Array.isArray(premiumRequests) ? premiumRequests : Object.values(premiumRequests || {});

      const premiumEmails = new Set(premiumList.map((r) => String(r?.email || '').toLowerCase()).filter(Boolean));
      const mapped = profileList.map((p, idx) => {
        const email = String(p?.email || '').toLowerCase();
        const plan = premiumEmails.has(email) ? 'premium' : 'free';
        return {
          id: p?.id || email || `user-${idx}`,
          name: p?.name || email.split('@')[0] || 'User',
          email,
          plan,
          joinedAtLabel: formatDate(p?.created_at || p?.createdAt || Date.now())
        };
      });

      const today = new Date().toISOString().slice(0, 10);
      const messagesToday = usageList
        .filter((u) => String(u?.usage_date || '').slice(0, 10) === today)
        .reduce((sum, u) => sum + Number(u?.chat_count || 0), 0);

      return res.status(200).json({
        success: true,
        admin: {
          name: user?.name || 'Admin',
          email: user?.email || '',
          role: user?.role || 'admin',
          plan: quota?.plan || 'free'
        },
        stats: {
          totalUsers: mapped.length,
          premiumUsers: mapped.filter((u) => u.plan === 'premium').length,
          messagesToday,
          revenue: premiumList.length * 10000,
          pendingReports: notificationList.filter((n) => String(n?.status || '').toLowerCase() === 'pending').length,
          pendingPremiumRequests: premiumRequestList.filter((r) => String(r?.status || '').toLowerCase() === 'pending').length
        },
        recentUsers: mapped.slice().reverse().slice(0, 5),
        allUsers: mapped.slice().reverse()
      });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        ...user,
        plan: quota?.plan || 'free',
        limits: quota?.limits || null,
        usage: quota?.usage || null,
        usageDate: quota?.usageDate || null
      }
    });
  } catch {
    return res.status(200).json({ authenticated: false, user: null });
  }
}
