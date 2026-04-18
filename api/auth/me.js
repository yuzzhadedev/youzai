export default function handler(req, res) {
  // In production, parse from cookie
  // For demo, return mock
  res.status(200).json({
    authenticated: false,
    user: null
  });
}
