import { upsertUserProfile } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)youz_user=([^;]+)/);
  if (!match) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const user = JSON.parse(decodeURIComponent(match[1]));
    const nextName = String(req.body?.name || user.name || 'User').trim().slice(0, 80);
    const nextEmail = String(req.body?.email || user.email || '').trim().toLowerCase();
    const updated = {
      ...user,
      name: nextName || user.name,
      email: nextEmail || user.email
    };
    await upsertUserProfile(updated);
    const secureFlag = process.env.VERCEL_URL ? ' Secure;' : '';
    res.setHeader('Set-Cookie', `youz_user=${encodeURIComponent(JSON.stringify(updated))}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax;${secureFlag}`);
    return res.status(200).json({ success: true, user: updated });
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid user session' });
  }
}
