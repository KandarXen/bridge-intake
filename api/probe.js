// api/probe.js
// After each business domain, Claude reviews the answers and decides whether
// ONE clarifying follow-up is warranted. Returns the follow-up text, or "NONE".

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, qa, businessCategory } = req.body;
  if (!qa) return res.status(400).json({ error: 'Missing qa' });

  const prompt = `You are conducting a business discovery interview for a ${businessCategory || 'small business'}. The client just answered the questions in the "${domain}" section below.

${qa}

Your job: decide if ONE short follow-up question would meaningfully improve the quality of this section. Ask a follow-up ONLY if an answer is vague, skips the actual question, or leaves an obvious gap that matters for understanding the business.

Rules:
- If the answers are clear and complete enough, respond with exactly: NONE
- If a follow-up genuinely helps, respond with ONLY the question itself — one sentence, warm and plain-spoken, no preamble.
- Never ask more than one question.
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
      // Fail gracefully — no probe rather than blocking the interview
      return res.status(200).json({ followup: 'NONE' });
    }

    const data = await response.json();
    const followup = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : 'NONE';
    return res.status(200).json({ followup });

  } catch (err) {
    console.error('Probe error:', err);
    return res.status(200).json({ followup: 'NONE' });
  }
}
