// api/hermes-log.js
// MVP Hermes monitor for the intake app. Writes append-only JSONL event logs
// into the Bridge To AI Google Drive folder using the same OAuth setup as
// save-to-drive.js. No client secrets or answer bodies are logged.

const DEFAULT_DRIVE_FOLDER_ID = '1EQ7LkKGUJwXmHbw3SxquSnuoBHrzOka5';
const LOG_PREFIX = 'Hermes_Intake_Event_Log';

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

function driveReady() {
  return !!(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

function logFilename(date = new Date()) {
  return `${LOG_PREFIX}_${date.toISOString().slice(0, 10)}.jsonl`;
}

async function findLogFile(accessToken, folderId, filename) {
  const query = [
    `name = '${filename.replace(/'/g, "\\'")}'`,
    `'${folderId}' in parents`,
    'trashed = false'
  ].join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id,name,size,webViewLink)');
  url.searchParams.set('pageSize', '1');

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Drive log lookup failed: ' + e);
  }

  const data = await resp.json();
  return data.files && data.files[0] ? data.files[0] : null;
}

async function downloadText(accessToken, fileId) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Drive log download failed: ' + e);
  }

  return resp.text();
}

async function createTextFile(accessToken, folderId, filename, content) {
  const boundary = 'hermes_boundary_' + Date.now();
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/jsonl'
  };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/jsonl\r\n\r\n' +
    content + '\r\n' +
    `--${boundary}--`;

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Drive log create failed: ' + e);
  }

  return resp.json();
}

async function updateTextFile(accessToken, fileId, content) {
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,webViewLink`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/jsonl'
    },
    body: content
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error('Drive log update failed: ' + e);
  }

  return resp.json();
}

function sanitizeEvent(body) {
  const details = body.details && typeof body.details === 'object' ? body.details : {};
  return {
    ts: new Date().toISOString(),
    app: 'intake.bridgetoai.ca',
    clientDraftId: String(body.clientDraftId || '').slice(0, 80),
    clientName: String(body.clientName || '').slice(0, 120),
    businessName: String(body.businessName || '').slice(0, 160),
    businessCategory: String(body.businessCategory || '').slice(0, 160),
    companySize: String(body.companySize || '').slice(0, 80),
    ownerWorkStatus: String(body.ownerWorkStatus || '').slice(0, 160),
    eventType: String(body.eventType || 'unknown').slice(0, 80),
    status: String(body.status || 'info').slice(0, 40),
    stage: String(body.stage || '').slice(0, 120),
    questionIndex: Number.isFinite(body.questionIndex) ? body.questionIndex : null,
    questionType: String(body.questionType || '').slice(0, 120),
    domain: String(body.domain || '').slice(0, 160),
    answerWordCount: Number.isFinite(body.answerWordCount) ? body.answerWordCount : null,
    details: {
      hasWebsite: !!details.hasWebsite,
      departments: Array.isArray(details.departments) ? details.departments.slice(0, 20).map(v => String(v).slice(0, 80)) : undefined,
      section: details.section ? String(details.section).slice(0, 160) : undefined,
      durationSeconds: Number.isFinite(details.durationSeconds) ? details.durationSeconds : undefined,
      questionCount: Number.isFinite(details.questionCount) ? details.questionCount : undefined,
      totalWordCount: Number.isFinite(details.totalWordCount) ? details.totalWordCount : undefined,
      repetitiveProbe: typeof details.repetitiveProbe === 'boolean' ? details.repetitiveProbe : undefined,
      autosaveTarget: details.autosaveTarget ? String(details.autosaveTarget).slice(0, 120) : undefined,
      draftSaved: typeof details.draftSaved === 'boolean' ? details.draftSaved : undefined,
      privacyAnonymized: typeof details.privacyAnonymized === 'boolean' ? details.privacyAnonymized : undefined,
      anonymizationReplacements: Number.isFinite(details.anonymizationReplacements) ? details.anonymizationReplacements : undefined,
      driveSaved: typeof details.driveSaved === 'boolean' ? details.driveSaved : undefined,
      driveReason: details.driveReason ? String(details.driveReason).slice(0, 400) : undefined,
      emailDelivered: typeof details.emailDelivered === 'boolean' ? details.emailDelivered : undefined,
      error: details.error ? String(details.error).slice(0, 500) : undefined,
      resumeUsed: typeof details.resumeUsed === 'boolean' ? details.resumeUsed : undefined
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!driveReady()) {
    return res.status(200).json({ logged: false, reason: 'Drive OAuth not configured' });
  }

  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
    const accessToken = await getAccessToken();
    const filename = logFilename();
    const event = sanitizeEvent(req.body || {});
    const line = JSON.stringify(event) + '\n';
    const existing = await findLogFile(accessToken, folderId, filename);

    let file;
    if (existing) {
      const current = await downloadText(accessToken, existing.id);
      file = await updateTextFile(accessToken, existing.id, current + line);
    } else {
      file = await createTextFile(accessToken, folderId, filename, line);
    }

    return res.status(200).json({ logged: true, fileId: file.id, link: file.webViewLink });
  } catch (err) {
    console.error('hermes-log error:', err);
    return res.status(200).json({ logged: false, reason: err.message });
  }
}
