// api/send-email.js
// Vercel serverless function — receives completed DNA interview and emails it to Darren
// Uses Resend (free tier: 3,000 emails/month) — sign up at resend.com

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, clientName, businessCategory, date, dnaContent } = req.body;

  if (!dnaContent || !clientName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Email HTML body
  const htmlBody = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #0f0f0f;">
      <div style="background: #0d6e5e; padding: 24px 32px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; font-size: 1.2rem; font-weight: 500; margin: 0;">
          Bridge To AI — New DNA Interview Complete
        </h1>
      </div>
      <div style="background: #fafaf8; border: 1px solid #e4e2dd; border-top: none; padding: 28px 32px; border-radius: 0 0 10px 10px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; font-size: 0.88rem; color: #8a8a8a; width: 140px;">Client</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; font-size: 0.88rem; font-weight: 500;">${clientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; font-size: 0.88rem; color: #8a8a8a;">Business type</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e4e2dd; font-size: 0.88rem;">${businessCategory}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 0.88rem; color: #8a8a8a;">Date</td>
            <td style="padding: 8px 0; font-size: 0.88rem;">${date}</td>
          </tr>
        </table>
        <p style="font-size: 0.9rem; color: #4a4a4a; line-height: 1.6; margin-bottom: 20px;">
          The full Business DNA file is attached as a <code>.md</code> file. 
          Load it into the client's Claude project to begin their workbench build.
        </p>
        <div style="background: #e8f4f1; border: 1px solid #b8ddd7; border-radius: 8px; padding: 16px 20px; font-size: 0.85rem; color: #0d6e5e;">
          <strong>Next step:</strong> Review the DNA file, validate the AI opportunity scores, 
          and schedule your debrief call with ${clientName.split('—')[0].trim()}.
        </div>
      </div>
      <p style="font-size: 0.75rem; color: #8a8a8a; text-align: center; margin-top: 16px;">
        Bridge To AI — Kandar Consulting · Alberta, Canada · Confidential
      </p>
    </div>
  `;

  // Plain text fallback with full DNA content
  const textBody = `
NEW DNA INTERVIEW COMPLETE — Bridge To AI
==========================================
Client: ${clientName}
Business type: ${businessCategory}
Date: ${date}

The full Business DNA file is attached.

==========================================
FULL DNA CONTENT (also attached as .md)
==========================================

${dnaContent}
  `;

  try {
    // Using Resend API — free, reliable, 3,000 emails/month
    // Sign up at resend.com, get your API key, add to Vercel env vars as RESEND_API_KEY
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Bridge To AI <intake@bridgetoai.ca>',
        to: [to],
        subject: subject,
        html: htmlBody,
        text: textBody,
        attachments: [
          {
            filename: `${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_VENTURE_DNA.md`,
            content: Buffer.from(dnaContent).toString('base64'),
            content_type: 'text/markdown'
          }
        ]
      })
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Email delivery failed', details: error });
    }

    const result = await emailResponse.json();
    return res.status(200).json({ success: true, id: result.id });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
