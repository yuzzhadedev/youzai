import { findUserByEmail, saveUser } from './store.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
  }

  const user = saveUser({ name, email, password });
  const { passwordHash, ...safeUser } = user;
  const secureFlag = process.env.VERCEL_URL ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `youz_user=${encodeURIComponent(JSON.stringify(safeUser))}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax;${secureFlag}`);
  return res.status(200).json({ success: true, user: safeUser });
}
