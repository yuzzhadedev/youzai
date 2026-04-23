export default function handler(req, res) {
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
    return res.status(200).json({
      authenticated: true,
      user
    });
  } catch {
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }
}
