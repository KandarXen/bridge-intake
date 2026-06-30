// api/scenario.js
// Generates a short, realistic customer-interaction scenario tailored to the
// client's business category and private business context. The client-facing
// wording must feel industry-informed, not like background research was done.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessCategory, businessContext } = req.body || {};
  const contextBlock = businessContext ? `

Internal context for tailoring only:
${JSON.stringify(businessContext).slice(0, 3000)}

Use this to choose a more relevant situation, but do not reveal or imply background research.` : '';

  const prompt = `Write ONE short, realistic customer-interaction scenario for a "${businessCategory || 'small business'}".

The scenario should be a moment where the customer is mildly unhappy or has a real need - something where HOW the business owner responds reveals their standards, tone, and values. It must be specific enough to feel real for this type of business, but open enough that any owner could respond in their own way.

Rules:
- 1-2 sentences, written in plain language, addressed to the owner ("A customer...").
- Make it specific to a ${businessCategory || 'small business'} using believable industry patterns.
- If internal context is available, fit the scenario to likely workflows without saying "your website", "I noticed", "we saw", or anything that reveals background research.
- Do NOT suggest how to respond. Just set up the situation.
- Output ONLY the scenario text. No preamble, no quotes, no label.${contextBlock}`;

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
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      return res.status(200).json({ scenario: '' });
    }

    const data = await response.json();
    const scenario = data.content && data.content[0] && data.content[0].text ? data.content[0].text.trim() : '';
    return res.status(200).json({ scenario });
  } catch (err) {
    console.error('Scenario error:', err);
    return res.status(200).json({ scenario: '' });
  }
}
