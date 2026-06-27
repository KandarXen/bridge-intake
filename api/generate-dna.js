// api/generate-dna.js
// Server-side function that calls Claude to compile the DNA file.
// Keeps the Anthropic API key hidden from the browser.
//
// TRUNCATION SAFEGUARD: Claude returns stop_reason "max_tokens" when it runs
// out of room mid-document. When that happens, we automatically ask it to
// continue from where it left off and stitch the parts together, so the DNA
// file is never silently cut short. Up to 3 continuation passes.

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const messages = [{ role: 'user', content: prompt }];
    let fullText = '';
    let stopReason = null;
    let passes = 0;
    const MAX_PASSES = 4; // initial + up to 3 continuations

    do {
      const data = await callClaude(messages);
      const piece = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
      fullText += piece;
      stopReason = data.stop_reason;
      passes++;

      if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
        // Feed back what we have and ask Claude to continue seamlessly.
        messages.push({ role: 'assistant', content: piece });
        messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
      } else {
        break;
      }
    } while (passes < MAX_PASSES);

    const truncated = (stopReason === 'max_tokens');
    if (truncated) {
      // Extremely rare given 4 passes, but never fail silently — flag it inline.
      fullText += '\n\n> ⚠️ NOTE TO DARREN: This DNA file reached the maximum generation length. The content above is complete through where it stops; regenerate or extend manually if a later section is cut.';
    }

    return res.status(200).json({ dnaContent: fullText, truncated });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
