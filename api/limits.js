import { getQuotaSnapshot, resolveUserKey } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const userContext = req.method === 'POST' ? req.body?.userContext : req.query;
  const userKey = resolveUserKey(req, userContext || {});
  return res.status(200).json({ success: true, ...(await getQuotaSnapshot(userKey)) });
}
