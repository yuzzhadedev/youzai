export default function handler(req, res) {
  const secureFlag = process.env.VERCEL_URL ? ' Secure;' : '';
  res.setHeader('Set-Cookie', [
    `user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax;${secureFlag}`,
    `youz_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax;${secureFlag}`
  ]);
}
