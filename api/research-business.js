// api/research-business.js
// Quietly builds an internal business context profile from the business type
// and optional website URL. Client-facing follow-ups should use generic
// industry-pattern language, not "we noticed on your website..." phrasing.

function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9000);
}

async function fetchWebsiteText(websiteUrl) {
  const url = normalizeUrl(websiteUrl);
  if (!url) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BridgeToAI-Intake/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!resp.ok) return '';
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return '';
    return extractVisibleText(await resp.text());
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseClaudeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Claude returned an empty context response');

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw firstErr;
  }
}
function fallbackContext({ businessCategory, websiteUrl }) {
  return {
    summary: '',
    offers: [],
    likelyCustomers: [],
    positioning: '',
    tone: '',
    likelyWorkflows: [],
    likelyAiOpportunities: [],
    questionGuidance: [],
    interviewLanguageRules: [
      'Use generic phrasing such as "businesses like yours", "your industry often", and "this type of operation".',
      'Do not say or imply that the website was researched during the interview.'
    ],
    source: websiteUrl ? 'business_type_with_website_unavailable' : 'business_type_only',
    businessCategory: businessCategory || ''
  };
}

async function callClaudeForContext({ businessName, businessCategory, companySize, departments, websiteUrl, websiteText }) {
  const prompt = `Build an INTERNAL business context profile for an AI implementation discovery interview.

Client-provided information:
- Business name: ${businessName || '(not provided)'}
- Business type/category: ${businessCategory || '(not provided)'}
- Website URL: ${websiteUrl || '(not provided)'}
- Company size: ${companySize || '(not provided)'}
- Departments/functions: ${departments && departments.length ? departments.join(', ') : '(not provided)'}

Website text, if available:
${websiteText || '(no website text available)'}

Return ONLY raw valid JSON with this exact shape. Do not wrap it in markdown, code fences, or explanatory text:
{
  "summary": "1-2 sentence private internal summary",
  "offers": ["visible or likely offer"],
  "likelyCustomers": ["customer segment"],
  "positioning": "how this business appears to position itself",
  "tone": "plain-language voice/tone notes",
  "likelyWorkflows": ["workflow likely to matter"],
  "likelyAiOpportunities": ["specific AI opportunity likely relevant"],
  "questionGuidance": ["guidance for asking sharper interview follow-ups"],
  "interviewLanguageRules": ["client-facing language rule"]
}

Rules:
- This profile is for Darren's private use only.
- Do NOT overstate certainty. Use "likely" when inferred.
- Interview questions must sound industry-informed, not researched. Prefer phrases like "businesses like yours often..." or "your business type can involve..."
- Do NOT write "your website says", "I noticed", "we saw", or anything that reveals background research to the client.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error('Context generation failed: ' + await response.text());
  const data = await response.json();
  const text = data.content && data.content[0] && data.content[0].text ? data.content[0].text.trim() : '';
  return parseClaudeJson(text);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessName, businessCategory, websiteUrl, companySize, departments } = req.body || {};
  if (!businessCategory && !websiteUrl) {
    return res.status(200).json({ context: fallbackContext({ businessCategory, websiteUrl }) });
  }

  try {
    const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
    const websiteText = await fetchWebsiteText(normalizedWebsiteUrl);
    const context = await callClaudeForContext({
      businessName,
      businessCategory,
      companySize,
      departments: Array.isArray(departments) ? departments : [],
      websiteUrl: normalizedWebsiteUrl,
      websiteText
    });

    return res.status(200).json({
      context: {
        ...fallbackContext({ businessCategory, websiteUrl: normalizedWebsiteUrl }),
        ...context,
        source: websiteText ? 'business_type_and_website' : 'business_type_only',
        websiteUrl: normalizedWebsiteUrl
      }
    });
  } catch (err) {
    console.error('research-business error:', err);
    return res.status(200).json({
      context: fallbackContext({ businessCategory, websiteUrl }),
      warning: err.message
    });
  }
}
