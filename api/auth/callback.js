export default async function handler(req, res) {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/callback`;
  
  try {
    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }
    
    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    
    const userData = await userRes.json();
    
    // Set cookie with user info
    const userInfo = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture
    };

    const encodedCookieUser = encodeURIComponent(JSON.stringify(userInfo));
    const secureFlag = process.env.VERCEL_URL ? ' Secure;' : '';
    res.setHeader('Set-Cookie', `youz_user=${encodedCookieUser}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax;${secureFlag}`);
    
    // Redirect to frontend with user data
    const encodedUser = encodeURIComponent(JSON.stringify(userInfo));
    res.redirect(`/?user=${encodedUser}`);
    
  } catch (error) {
    console.error('OAuth Error:', error);
    res.redirect('/?error=auth_failed');
  }
}
