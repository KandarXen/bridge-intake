// api/save-to-drive.js
// Saves the completed DNA file to a Google Drive folder using a service account.
// Uses direct REST + a hand-signed JWT — NO npm dependencies, so the app stays
// dependency-free and deploys as plain files.
//
// REQUIRED ENV VARS (set in Vercel):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  — the service account's email
//   GOOGLE_PRIVATE_KEY            — the service account's private key (PEM, with \n line breaks)
//   GOOGLE_DRIVE_FOLDER_ID        — the ID of the shared Drive folder to write into
//
// The target Drive folder must be SHARED with the service account email (Editor).

import crypto from 'crypto';

// ── Build a signed JWT and exchange it for an access token ──────────────────
async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY || '';
  // Vercel stores the key with literal \n — convert to real newlines
  key = key.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Token exchange failed: ' + e);
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

  // If Drive isn't configured, return gracefully so the caller can still email.
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return res.status(200).json({ saved: false, reason: 'Drive not configured' });
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
