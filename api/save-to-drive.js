// api/save-to-drive.js
// Saves the completed DNA file to Darren's own Google Drive (2TB personal storage)
// using OAuth refresh-token delegation — NOT a service account (service accounts
// have no Drive storage quota on regular Gmail accounts, only on Workspace).
//
// REQUIRED ENV VARS (set in Vercel):
//   GOOGLE_OAUTH_CLIENT_ID      — from Google Cloud Console > Credentials > OAuth Client
//   GOOGLE_OAUTH_CLIENT_SECRET  — same place
//   GOOGLE_OAUTH_REFRESH_TOKEN  — captured ONCE via the one-time authorization flow
//                                 (see /api/oauth-authorize and /api/oauth-callback)
//   GOOGLE_DRIVE_FOLDER_ID      — the Drive folder ID to save into (Darren's own folder,
//                                 no sharing needed since this uses Darren's own account)
//
// NO npm dependencies — direct REST calls only.

// ── Exchange the long-lived refresh token for a short-lived access token ────
async function getAccessToken() {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Token refresh failed: ' + e);
  }
  const data = await resp.json();
  return data.access_token;
}

// ── Upload the DNA markdown as a file in the target folder ──────────────────
async function uploadFile(accessToken, filename, content) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const metadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined,
    mimeType: 'text/markdown'
  };

  const boundary = 'bridge_boundary_' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: text/markdown\r\n\r\n' +
    content + '\r\n' +
    `--${boundary}--`;

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Drive upload failed: ' + e);
  }
  return resp.json(); // { id, webViewLink }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, dnaContent } = req.body;
  if (!dnaContent || !filename) {
    return res.status(400).json({ error: 'Missing filename or dnaContent' });
  }

  if (
    !process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_DRIVE_FOLDER_ID
  ) {
    return res.status(200).json({ saved: false, reason: 'Drive OAuth not configured' });
  }

  try {
    const token = await getAccessToken();
    const file = await uploadFile(token, filename, dnaContent);
    return res.status(200).json({ saved: true, fileId: file.id, link: file.webViewLink });
  } catch (err) {
    console.error('save-to-drive error:', err);
    // Never fail the whole flow — report failure so email still fires.
    return res.status(200).json({ saved: false, reason: err.message });
  }
}
