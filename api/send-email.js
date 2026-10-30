import { decryptJson } from '../lib/crypto.js';
import { assertDraftAccess } from '../lib/draft-access.js';
import { getIntakeSession } from '../lib/supabase-rest.js';
import { assertRateLimit, assertTrustedOrigin, safeError } from '../lib/security.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value, length = 160) {
  return String(value || '').trim().slice(0, length);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'completion-notification', limit: 5, windowMs: 60_000 });

    const recordId = clean(req.body?.recordId, 120);
    const draftAccessToken = clean(req.body?.draftAccessToken, 4096);
    if (!recordId) return res.status(400).json({ error: 'Missing recordId' });
    assertDraftAccess(draftAccessToken, recordId);
    if (String(process.env.BTAI_ENABLE_COMPLETION_NOTIFICATIONS || '').toLowerCase() !== 'true') {
      return res.status(503).json({ error: 'Completion notifications are not enabled for this pilot' });
    }

    const session = await getIntakeSession(recordId);
    if (!session?.encrypted_payload) return res.status(404).json({ error: 'No secure intake record found' });
    const payload = decryptJson(session.encrypted_payload);
    if (!payload?.privacyConsent || !payload?.privacyConsentAt || !payload?.privacyPolicyVersion) {
      return res.status(409).json({ error: 'Privacy consent must be recorded before notification' });
    }
    if (session.status !== 'complete') return res.status(409).json({ error: 'Intake is not complete' });

    if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email service is not configured' });
    const recipient = clean(process.env.INTAKE_DIRECT_RECIPIENT, 320);
    if (!recipient) return res.status(503).json({ error: 'Notification recipient is not configured' });

    const fields = {
      clientName: clean(payload.clientName, 120) || 'Not provided',
      clientEmail: clean(payload.clientEmail, 320) || 'Not provided',
      businessCategory: clean(payload.businessCategory, 160) || 'Not provided',
      partner: clean(payload.partnerDisplayName || payload.campaignPartner || 'BTAI', 120),
      campaign: clean(payload.campaignId || 'general_intake', 120),
      consentAt: clean(payload.privacyConsentAt, 80),
      policyVersion: clean(payload.privacyPolicyVersion, 80)
    };
    const html = `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Bridge To AI — Intake Complete</h1><p>A verified intake is ready for internal review.</p><table><tr><th align="left">Client</th><td>${escapeHtml(fields.clientName)}</td></tr><tr><th align="left">Email</th><td>${escapeHtml(fields.clientEmail)}</td></tr><tr><th align="left">Business type</th><td>${escapeHtml(fields.businessCategory)}</td></tr><tr><th align="left">Partner / campaign</th><td>${escapeHtml(fields.partner)} / ${escapeHtml(fields.campaign)}</td></tr><tr><th align="left">Consent</th><td>Accepted at ${escapeHtml(fields.consentAt)} (policy ${escapeHtml(fields.policyVersion)})</td></tr><tr><th align="left">Record</th><td><code>${escapeHtml(recordId)}</code></td></tr></table><p>This notification contains no report content or attachments.</p></div>`;
    const text = `BTAI intake complete\nClient: ${fields.clientName}\nEmail: ${fields.clientEmail}\nBusiness type: ${fields.businessCategory}\nPartner/campaign: ${fields.partner} / ${fields.campaign}\nConsent: accepted at ${fields.consentAt} (policy ${fields.policyVersion})\nRecord: ${recordId}\n\nNo report content or attachments are included.`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'The Bridge Team <team@bridgetoai.ca>', to: [recipient], subject: 'Bridge To AI intake complete', html, text })
    });
    if (!response.ok) {
      console.error('Resend completion notification failed:', response.status);
      return res.status(502).json({ error: 'Email delivery failed' });
    }
    const result = await response.json();
    return res.status(200).json({ success: true, id: result.id, notificationOnly: true });
  } catch (err) {
    console.error('completion notification error:', err);
    return safeError(res, err, 'Email service unavailable');
  }
}
