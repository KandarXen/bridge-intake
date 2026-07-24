// api/send-email.js
// Sends completion notifications through Resend. By default this endpoint does
// not email raw DNA content or attachments; the encrypted Supabase record is the
// system of record.

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function attachmentsEnabled() {
  return String(process.env.INTAKE_EMAIL_ATTACHMENTS_ENABLED || '').toLowerCase() === 'true';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    to,
    subject,
    clientName,
    businessCategory,
    companySize,
    ownerWorkStatus,
    departments,
    date,
    recordId,
    secureStorage,
    dnaContent
  } = req.body || {};

  if (!clientName) {
    return res.status(400).json({ error: 'Missing clientName' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return res.status(500).json({ error: 'Email service is not configured', details: 'Missing RESEND_API_KEY' });
  }

  const directRecipient = process.env.INTAKE_DIRECT_RECIPIENT || 'darren@ourcopacker.ca';
  const bccRecipient = process.env.INTAKE_BCC_RECIPIENT || 'darren.randles@gmail.com';
  const recipients = uniqueList([to || 'team@bridgetoai.ca', directRecipient]);
  const bccRecipients = uniqueList([bccRecipient]);
  const includeAttachment = attachmentsEnabled() && !!dnaContent;
  const storageStatus = secureStorage?.saved ? 'Encrypted Supabase storage confirmed' : 'Secure storage did not confirm';

  const htmlBody = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <div style="background: #0d6e5e; padding: 24px 32px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; font-size: 1.15rem; font-weight: 600; margin: 0;">
          Bridge To AI - New Intake Complete
        </h1>
      </div>
      <div style="background: #fafaf8; border: 1px solid #e4e2dd; border-top: none; padding: 28px 32px; border-radius: 0 0 10px 10px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280; width: 150px;">Client</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; font-weight: 600;">${clientName}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280;">Business type</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd;">${businessCategory || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280;">Size</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd;">${companySize || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280;">Owner status</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd;">${ownerWorkStatus || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280;">Departments</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd;">${departments || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; color: #6b7280;">Record ID</td><td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd;"><code>${recordId || 'Not provided'}</code></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="padding: 8px 0;">${date || new Date().toISOString()}</td></tr>
        </table>

        <div style="background: ${secureStorage?.saved ? '#e8f4f1' : '#fdf6e8'}; border: 1px solid ${secureStorage?.saved ? '#b8ddd7' : '#f0d9a8'}; border-radius: 8px; padding: 14px 16px; font-size: 0.9rem; color: ${secureStorage?.saved ? '#0d6e5e' : '#8a6d2a'}; margin-bottom: 18px;">
          <strong>${storageStatus}.</strong>
          ${secureStorage?.reason ? `<br>Reason: ${secureStorage.reason}` : ''}
        </div>

        <p style="font-size: 0.9rem; line-height: 1.6; color: #374151;">
          The completed intake output is stored in the secure backend record above. This email is a notification only${includeAttachment ? ', with emergency attachment mode enabled' : ''}.
        </p>
      </div>
      <p style="font-size: 0.75rem; color: #8a8a8a; text-align: center; margin-top: 16px;">
        Bridge To AI - Alberta, Canada - Confidential
      </p>
    </div>
  `;

  const textBody = `
NEW INTAKE COMPLETE - Bridge To AI
==================================
Client: ${clientName}
Business type: ${businessCategory || 'Not provided'}
Record ID: ${recordId || 'Not provided'}
Date: ${date || new Date().toISOString()}
Storage: ${storageStatus}

This is a notification-only email. The encrypted intake output is stored in the secure backend record.
`;

  const emailPayload = {
    from: 'The Bridge Team <team@bridgetoai.ca>',
    to: recipients,
    bcc: bccRecipients,
    subject: subject || `New Intake Complete - ${clientName}`,
    html: htmlBody,
    text: textBody
  };

  if (includeAttachment) {
    emailPayload.attachments = [
      {
        filename: `${String(clientName).replace(/[^a-zA-Z0-9]/g, '_')}_VENTURE_DNA.md`,
        content: Buffer.from(dnaContent).toString('base64'),
        content_type: 'text/markdown'
      }
    ];
  }

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Email delivery failed', details: error });
    }

    const result = await emailResponse.json();
    return res.status(200).json({ success: true, id: result.id, attachmentIncluded: includeAttachment });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
