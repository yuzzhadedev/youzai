import { createPremiumRequest, resolveUserKey, confirmPremium, getQuotaSnapshot } from '../lib/db.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const userKey = resolveUserKey(req, req.query || {});
    return res.status(200).json({
      success: true,
      pricePerMonth: 10000,
      methods: ['qris', 'dana', 'gopay'],
      benefits: [
        'Chat terenkripsi',
        'Limit obrolan 120/hari',
        'Image generate 15/hari',
        'Unlock model AI lanjutan (dalam pengembangan)',
        'AI fast'
      ],
      ...getQuotaSnapshot(userKey)
    });
  }

  if (req.method === 'POST') {
    const { userContext = {}, method = 'qris', notes = '', action } = req.body || {};

    if (action === 'confirm') {
      if (!process.env.ADMIN_CONFIRM_TOKEN || req.headers['x-admin-token'] !== process.env.ADMIN_CONFIRM_TOKEN) {
        return res.status(403).json({ success: false, content: 'Admin token tidak valid.' });
      }
      const userKey = String(req.body?.targetUserKey || '').trim();
      if (!userKey) return res.status(400).json({ success: false, content: 'targetUserKey wajib diisi.' });
      confirmPremium({ userKey, months: Number(req.body?.months) || 1, admin: 'manual-admin' });
      return res.status(200).json({ success: true, content: 'Premium berhasil diaktifkan.' });
    }

    const userKey = resolveUserKey(req, userContext);
    const request = createPremiumRequest({
      userKey,
      name: userContext?.name || '',
      email: userContext?.email || '',
      method,
      notes
    });

    return res.status(200).json({
      success: true,
      content: 'Permintaan premium diterima. Menunggu konfirmasi admin.',
      request
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
