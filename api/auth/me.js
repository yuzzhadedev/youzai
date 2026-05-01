import { getQuotaSnapshot, resolveUserKey } from '../../lib/db.js';

export default async function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)youz_user=([^;]+)/);

  if (!match) {
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }

  try {
    const user = JSON.parse(decodeURIComponent(match[1]));
    const userKey = resolveUserKey(req, user || {});
    const quota = await getQuotaSnapshot(userKey);
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
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }
}
