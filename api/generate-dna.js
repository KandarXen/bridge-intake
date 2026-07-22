// api/generate-dna.js
// Server-side function that calls Claude to compile the DNA file.
// Keeps the Anthropic API key hidden from the browser.
// Hermes privacy layer: anonymizes obvious identifiers before sending the
// prompt to Claude, then re-identifies the final output before returning it.

const DEFAULT_DRIVE_FOLDER_ID = '1EQ7LkKGUJwXmHbw3SxquSnuoBHrzOka5';

async function callClaude(messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error('Anthropic API call failed: ' + error);
  }
  return response.json();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

function anonymizePrompt(prompt) {
  const mapping = {};

  addMapping(mapping, '[OWNER_NAME]', extractField(prompt, 'Owner Name'));
  addMapping(mapping, '[BUSINESS_NAME]', extractField(prompt, 'Business Name'));
  addMapping(mapping, '[BUSINESS_CATEGORY]', extractField(prompt, 'Business Category'));
  addMapping(mapping, '[WEBSITE_URL]', extractField(prompt, 'Website URL'));

  let anonymized = prompt;

  Object.entries(mapping)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([placeholder, value]) => {
      anonymized = replaceAllLiteral(anonymized, value, placeholder);
    });

  let emailCount = 0;
  anonymized = anonymized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, match => {
    const placeholder = `[EMAIL_${++emailCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let phoneCount = 0;
  anonymized = anonymized.replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, match => {
    const placeholder = `[PHONE_${++phoneCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let urlCount = 0;
  anonymized = anonymized.replace(/https?:\/\/[^\s)]+/gi, match => {
    if (Object.values(mapping).includes(match)) return '[WEBSITE_URL]';
    const placeholder = `[URL_${++urlCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let moneyAccountCount = 0;
  anonymized = anonymized.replace(/\b(?:\d[ -]*?){13,19}\b/g, match => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    const placeholder = `[FINANCIAL_ACCOUNT_${++moneyAccountCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  const privacyHeader = `HERMES PRIVACY LAYER ACTIVE:\nThe source interview below has been anonymized before model analysis. Use placeholders exactly as given. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n`;

  return {
    anonymizedPrompt: privacyHeader + anonymized,
    mapping,
    stats: {
      replacements: Object.keys(mapping).length,
      emails: emailCount,
      phones: phoneCount,
      urls: urlCount,
      financialAccounts: moneyAccountCount
    }
  };
}

function reidentifyText(text, mapping) {
  let output = text || '';
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

function driveReady() {
  return !!(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

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

async function uploadMappingFile(filename, content) {
  if (!driveReady()) return { saved: false, reason: 'Drive OAuth not configured' };

  const accessToken = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
  const boundary = 'hermes_privacy_boundary_' + Date.now();
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json'
  };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
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
    throw new Error('Mapping upload failed: ' + e);
  }

  const file = await resp.json();
  return { saved: true, fileId: file.id, link: file.webViewLink };
}

async function saveAnonymizationMapping(mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };

    const business = mapping['[BUSINESS_NAME]'] || 'Client_Business';
    const safeBusiness = business.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${safeBusiness}_HERMES_PRIVATE_MAPPING_${dateStr}.json`;
    const content = JSON.stringify({
      createdAt: new Date().toISOString(),
      warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
      stats,
      mapping
    }, null, 2);

    return await uploadMappingFile(filename, content);
  } catch (err) {
    console.error('Hermes mapping save failed:', err);
    return { saved: false, reason: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const hermesPrivacy = anonymizePrompt(prompt);
    const mappingSave = await saveAnonymizationMapping(hermesPrivacy.mapping, hermesPrivacy.stats);
    const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
    let fullText = '';
    let stopReason = null;
    let passes = 0;
    const MAX_PASSES = 4;

    do {
      const data = await callClaude(messages);
      const piece = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
      fullText += piece;
      stopReason = data.stop_reason;
      passes++;

      if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
        messages.push({ role: 'assistant', content: piece });
        messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
      } else {
        break;
      }
    } while (passes < MAX_PASSES);

    const truncated = (stopReason === 'max_tokens');
    if (truncated) {
      fullText += '\n\n> NOTE TO DARREN: This DNA file reached the maximum generation length. The content above is complete through where it stops; regenerate or extend manually if a later section is cut.';
    }

    const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);

    return res.status(200).json({
      dnaContent: reidentifiedText,
      truncated,
      hermesPrivacy: {
        anonymized: true,
        stats: hermesPrivacy.stats,
        mappingSaved: !!mappingSave.saved,
        mappingSaveReason: mappingSave.reason || '',
        mappingFileId: mappingSave.fileId || ''
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
