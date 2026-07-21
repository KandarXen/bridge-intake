// api/mastery-followup.js
// Generates a reflective follow-up for an owner-mastery answer: picks up
// something specific the client said and asks what AI handling it would change.
// Returns the follow-up text, or "NONE" to fall back to the generic line.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { area, answer, businessCategory, companySize, ownerWorkStatus, departments = [], businessContext } = req.body || {};
  if (!answer) return res.status(400).json({ error: 'Missing answer' });

  const contextBlock = businessContext ? `

Internal context for tailoring only:
${JSON.stringify(businessContext).slice(0, 2500)}

Use this only to understand likely business pressures. Do not say "your website", "I noticed", "we saw", or imply background research happened.` : '';

  const orgContext = `Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
const soloOrNoStaff = /(^|\D)(0|1)(\D|$)/.test(String(companySize || '')) || /semi[- ]?retired|mostly just me|solo|self[- ]?employed|no employees/i.test(`${ownerWorkStatus || ''} ${Array.isArray(departments) ? departments.join(' ') : ''}`);

  const prompt = `You are conducting a warm, professional business discovery interview for a ${businessCategory || 'small business'} owner.

Organization context:
${orgContext}
${soloOrNoStaff ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask about staff, employees, departments, or team handoffs as if they currently exist. Use wording like "you," "helpers," "future hires," or "outside support" only when appropriate.' : ''}

You just asked them where they are with "${area}". They answered:

"${answer}"
${contextBlock}

Write ONE short follow-up question that:
- Picks up a SPECIFIC thing they actually said (name it, quote a phrase or detail from their answer)
- Then asks what it would free them up to do, or how it would change things, if AI quietly handled that specific thing for them
- Sounds human and conversational, not robotic - one sentence, no preamble
- Respect the organization context. If they are solo, no-staff, or semi-retired, do not ask staff/team/departments questions unless they explicitly mentioned employees.
- If you use industry context, phrase it generally as a pattern in this kind of business, not as a researched observation

If their answer is too vague or thin to reflect anything specific back, respond with exactly: NONE

Output ONLY the question, or "NONE". Nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      return res.status(200).json({ followup: 'NONE' });
    }

    const data = await response.json();
    const followup = data.content && data.content[0] && data.content[0].text ? data.content[0].text.trim() : 'NONE';
    return res.status(200).json({ followup });
  } catch (err) {
    console.error('Mastery follow-up error:', err);
    return res.status(200).json({ followup: 'NONE' });
  }
}
