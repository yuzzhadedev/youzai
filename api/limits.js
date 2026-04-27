import { getQuotaSnapshot, resolveUserKey } from './_db.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const userContext = req.method === 'POST' ? req.body?.userContext : req.query;
  const userKey = resolveUserKey(req, userContext || {});
  return res.status(200).json({ success: true, ...getQuotaSnapshot(userKey) });
}
