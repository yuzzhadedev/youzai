export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_URL || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${proto}://${host}/api/auth/callback`;
  
  const scope = 'email profile';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  
  res.redirect(authUrl);
}
