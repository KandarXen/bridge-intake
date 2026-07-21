// api/probe.js
// After each business domain, Claude reviews the answers and decides whether
// ONE clarifying follow-up is warranted. Returns the follow-up text, or "NONE".

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, qa, businessCategory, companySize, ownerWorkStatus, departments = [], businessContext } = req.body || {};
  if (!qa) return res.status(400).json({ error: 'Missing qa' });

  const contextBlock = businessContext ? `

Internal context for sharper judgment only:
${JSON.stringify(businessContext).slice(0, 3000)}

Use this to understand likely workflows and industry patterns. Client-facing wording must sound generic and industry-informed, such as "businesses like yours often..." or "this type of operation can...". Do not say "your website", "I noticed", "we saw", or imply background research happened.` : '';

  const orgContext = `Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
const soloOrNoStaff = /(^|\D)(0|1)(\D|$)/.test(String(companySize || '')) || /semi[- ]?retired|mostly just me|solo|self[- ]?employed|no employees/i.test(`${ownerWorkStatus || ''} ${Array.isArray(departments) ? departments.join(' ') : ''}`);

  const prompt = `You are conducting a business discovery interview for a ${businessCategory || 'small business'}.

Organization context:
${orgContext}
${soloOrNoStaff ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask about staff, employees, departments, or team handoffs as if they currently exist. Use wording like "you," "helpers," "future hires," or "outside support" only when appropriate.' : ''}

The client just answered the questions in the "${domain}" section below.

${qa}
${contextBlock}

Your job: decide if ONE short follow-up question would meaningfully improve the quality of this section. Default to NONE. Ask a follow-up only when the section would be genuinely hard to analyze without one more concrete fact.

Rules:
- If the answers are clear enough to analyze, respond with exactly: NONE.
- If the client gave a reasonable answer but not every detail, respond with NONE. Do not chase completeness.
- Do not ask broad recap questions such as "walk me through your process," "what does your current process look like," "is this documented," "who owns this," or "what happens from first contact to delivery" when the fixed interview already asked about process, sales, delivery, handoffs, systems, or documentation.
- Do not ask a question that combines multiple parts of the interview, such as sales plus onboarding plus delivery plus documentation.
- Only ask a follow-up if it targets one missing, high-value fact: a number, a bottleneck, a tool name, a decision owner, a deadline, a conversion point, or a risk.
- If a follow-up genuinely helps, respond with ONLY the question itself - one sentence, warm and plain-spoken, no preamble.
- Never ask more than one question.
- Respect the organization context. If they are solo, no-staff, or semi-retired, do not ask staff/team/departments questions unless they explicitly mentioned employees.
- If using context, frame it as a general business-type pattern, not as something observed from their website.
- Do not explain your choice. Output either "NONE" or the single question.`;

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
    console.error('Probe error:', err);
    return res.status(200).json({ followup: 'NONE' });
  }
}
