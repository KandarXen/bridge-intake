// api/oauth-callback.js
// ONE-TIME SETUP ENDPOINT — Google redirects here after you approve access.
// Exchanges the authorization code for a refresh token and DISPLAYS IT ONCE
// on screen so you can copy it into Vercel as GOOGLE_OAUTH_REFRESH_TOKEN.
//
// SECURITY NOTE: this page shows a powerful credential in plain text. Use it
// once, copy the token, save it to Vercel, then you never need to visit this
// URL again (unless you re-authorize).

export default async function handler(req, res) {
  const { code, error, state } = req.query;

  const setupSecret = process.env.OAUTH_SETUP_SECRET;
  if (!setupSecret) {
    return res.status(500).send('<h2>OAuth setup is not configured.</h2>');
  }
  if (state !== setupSecret) {
    return res.status(404).send('Not found');
  }

  if (error) {
    return res.status(400).send(`<h2>Authorization failed</h2><p>${error}</p>`);
  }
  if (!code) {
    return res.status(400).send('<h2>Missing authorization code.</h2>');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `https://${req.headers.host}/api/oauth-callback`;

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
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

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(400).send(`<h2>Token exchange failed</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    if (!data.refresh_token) {
      return res.status(200).send(`
        <h2>No refresh token returned</h2>
        <p>This usually means you've already authorized before. Go to
        <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a>,
        remove access for this app, then visit
        <a href="/api/oauth-authorize">/api/oauth-authorize</a> again.</p>
      `);
    }

    res.status(200).send(`
      <html><body style="font-family: sans-serif; max-width: 600px; margin: 60px auto; line-height: 1.6;">
        <h2>✅ Authorization successful</h2>
        <p>Copy the value below and paste it into Vercel as the environment variable
        <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>, then redeploy.</p>
        <textarea style="width:100%; height:80px; font-family: monospace; padding:10px;" readonly onclick="this.select()">${data.refresh_token}</textarea>
        <p style="color:#888; font-size:0.9em;">This token does not expire unless you revoke it. You will not need to visit this page again.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`<h2>Server error</h2><pre>${err.message}</pre>`);
  }
}
