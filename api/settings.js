import { resolveUserKey, getUserSettings, upsertUserSettings } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userContext = req.method === 'POST' ? req.body?.userContext : req.query;
  const userKey = resolveUserKey(req, userContext || {});

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

