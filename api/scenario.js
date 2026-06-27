// api/scenario.js
// Generates a short, realistic customer-interaction scenario tailored to the
// client's business category. The client then writes a "good" and a "bad"
// reply to it, revealing their voice and standards.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessCategory } = req.body;

  const prompt = `Write ONE short, realistic customer-interaction scenario for a "${businessCategory || 'small business'}".

The scenario should be a moment where the customer is mildly unhappy or has a real need — something where HOW the business owner responds reveals their standards, tone, and values. It must be specific enough to feel real for this type of business, but open enough that any owner could respond in their own way.

Rules:
- 1-2 sentences, written in plain language, addressed to the owner ("A customer...").
- Make it specific to a ${businessCategory || 'small business'} — use a believable situation from that world.
- Do NOT suggest how to respond. Just set up the situation.
- Output ONLY the scenario text. No preamble, no quotes, no label.`;

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
      return res.status(200).json({ scenario: '' }); // client has a fallback
    }

    const data = await response.json();
    const scenario = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '';
    return res.status(200).json({ scenario });

  } catch (err) {
    console.error('Scenario error:', err);
    return res.status(200).json({ scenario: '' });
  }
}
