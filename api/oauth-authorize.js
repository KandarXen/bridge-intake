// api/oauth-authorize.js
// ONE-TIME SETUP ENDPOINT — visit this URL once in your browser to authorize
// the app to save files to your own Google Drive. It redirects you to Google's
// login/consent screen. After you approve, Google sends you to /api/oauth-callback,
// which gives you the refresh token to paste into Vercel.
//
// Visit: https://intake.bridgetoai.ca/api/oauth-authorize
//
// REQUIRED ENV VARS:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET (not used here, but must exist for callback step)
//   GOOGLE_OAUTH_REDIRECT_URI  e.g. https://intake.bridgetoai.ca/api/oauth-callback
//   OAUTH_SETUP_SECRET         temporary setup password for this endpoint

export default async function handler(req, res) {
  const setupSecret = process.env.OAUTH_SETUP_SECRET;
  if (!setupSecret) {
    return res.status(500).send('OAUTH_SETUP_SECRET is not set. Refusing to start OAuth setup.');
  }
  if (req.query.setup !== setupSecret) {
    return res.status(404).send('Not found');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('GOOGLE_OAUTH_CLIENT_ID is not set in Vercel environment variables.');
  }

  // Must exactly match a Redirect URI configured in Google Cloud Console.
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `https://${req.headers.host}/api/oauth-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',   // required to get a refresh token
    prompt: 'consent',        // forces Google to re-issue a refresh token every time
    state: setupSecret
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.writeHead(302, { Location: authUrl });
  res.end();
}
