import { anonymizeText, privacyHeader, reidentifyText } from '../lib/privacy.js';

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
        Accept: 'text/html,application/xhtml+xml'
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
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
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

async function callClaude(prompt, { maxTokens = 600, explicitIdentifiers = {} } = {}) {
  const privacy = anonymizeText(prompt, explicitIdentifiers);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: privacyHeader() + privacy.anonymizedText }]
    })
  });
  if (!response.ok) throw new Error('Claude call failed: ' + await response.text());
  const data = await response.json();
  const raw = data.content?.[0]?.text ? data.content[0].text.trim() : '';
  return reidentifyText(raw, privacy.mapping);
}

async function researchBusiness(body) {
  const { businessName, businessCategory, businessNiche, shareComfort, websiteUrl, companySize, departments } = body || {};
  if (!businessCategory && !websiteUrl) return { context: fallbackContext({ businessCategory, websiteUrl }) };

  try {
    const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
    const websiteText = await fetchWebsiteText(normalizedWebsiteUrl);
    const prompt = `Build an INTERNAL business context profile for an AI implementation discovery interview.

Client-provided information:
- Business name: ${businessName || '(not provided)'}
- Business type/category: ${businessCategory || '(not provided)'}
- Specific niche: ${businessNiche || '(not provided)'}
- Detail-sharing comfort: ${shareComfort || '(not provided)'}
- Website URL: ${normalizedWebsiteUrl || '(not provided)'}
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
- Interview questions must sound industry-informed, not researched.
- Do NOT write "your website says", "I noticed", "we saw", or anything that reveals background research to the client.`;

    const text = await callClaude(prompt, { maxTokens: 1400, explicitIdentifiers: { businessName, websiteUrl: normalizedWebsiteUrl } });
    const context = parseClaudeJson(text);
    return {
      context: {
        ...fallbackContext({ businessCategory, websiteUrl: normalizedWebsiteUrl }),
        ...context,
        source: websiteText ? 'business_type_and_website' : 'business_type_only',
        websiteUrl: normalizedWebsiteUrl
      }
    };
  } catch (err) {
    console.error('research-business error:', err);
    return { context: fallbackContext({ businessCategory, websiteUrl }), warning: err.message };
  }
}

async function scenario(body) {
  const { businessCategory, businessContext } = body || {};
  const contextBlock = businessContext ? `\n\nInternal context for tailoring only:\n${JSON.stringify(businessContext).slice(0, 3000)}\n\nUse this to choose a more relevant situation, but do not reveal or imply background research.` : '';
  const prompt = `Write ONE short, realistic customer-interaction scenario for a "${businessCategory || 'small business'}".

The scenario should be a moment where the customer is mildly unhappy or has a real need - something where HOW the business owner responds reveals their standards, tone, and values. It must be specific enough to feel real for this type of business, but open enough that any owner could respond in their own way.

Rules:
- 1-2 sentences, written in plain language, addressed to the owner ("A customer...").
- Make it specific to a ${businessCategory || 'small business'} using believable industry patterns.
- If internal context is available, fit the scenario to likely workflows without saying "your website", "I noticed", "we saw", or anything that reveals background research.
- Do NOT suggest how to respond. Just set up the situation.
- Output ONLY the scenario text. No preamble, no quotes, no label.${contextBlock}`;
  try {
    return { scenario: await callClaude(prompt, { maxTokens: 200 }) };
  } catch (err) {
    console.error('Scenario error:', err);
    return { scenario: '' };
  }
}

function soloOrNoStaff(companySize, ownerWorkStatus, departments) {
  return /(^|\D)(0|1)(\D|$)/.test(String(companySize || '')) || /semi[- ]?retired|mostly just me|solo|self[- ]?employed|no employees/i.test(`${ownerWorkStatus || ''} ${Array.isArray(departments) ? departments.join(' ') : ''}`);
}

async function probe(body) {
  const { domain, qa, businessCategory, businessNiche, shareComfort, companySize, ownerWorkStatus, departments = [], businessContext } = body || {};
  if (!qa) return { status: 400, body: { error: 'Missing qa' } };
  const contextBlock = businessContext ? `\n\nInternal context for sharper judgment only:\n${JSON.stringify(businessContext).slice(0, 3000)}\n\nUse this to understand likely workflows and industry patterns. Do not reveal background research.` : '';
  const orgContext = `Specific niche: ${businessNiche || 'not specified'}. Detail-sharing comfort: ${shareComfort || 'directional only'}. Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
  const prompt = `You are conducting a business discovery interview for a ${businessCategory || 'small business'}.

Organization context:
${orgContext}
${soloOrNoStaff(companySize, ownerWorkStatus, departments) ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask about staff, employees, departments, or team handoffs as if they currently exist.' : ''}

The client just answered the questions in the "${domain}" section below.

${qa}
${contextBlock}

Your job: decide if ONE short follow-up question would meaningfully improve the quality of this section. Default to no follow-up.

Rules:
- If the answers are clear enough to analyze, return ask_followup false.
- Do not ask broad recap questions such as "walk me through your process" or "what does your current process look like".
- Only ask for one missing high-value fact.
- Keep the question under 220 characters.
- Ask for directional ranges, severity, priority, frequency, blocker, owner/readiness, risk, low-risk pilot, clarify, or voice/tone only.
- Never ask for exact revenue, exact profit, exact margin, payroll, bank/tax/legal records, customer names, supplier names, employee personal details, recipes, formulas, contracts, invoices, purchase orders, passwords, API keys, health information, or legal personal information.
- Do not recommend tools, vendors, or Bridge To AI services during the interview.

Return ONLY raw valid JSON. Do not wrap it in markdown:
{
  "ask_followup": true,
  "question_type": "clarify",
  "domain": "${domain}",
  "question": "One safe, short follow-up question or empty string",
  "why_needed": "Short internal reason",
  "sensitivity_level": "low",
  "uses_approved_category": true
}

If no follow-up is needed, return:
{
  "ask_followup": false,
  "question_type": "clarify",
  "domain": "${domain}",
  "question": "",
  "why_needed": "Answers are sufficient",
  "sensitivity_level": "low",
  "uses_approved_category": true
}`;
  try {
    const raw = await callClaude(prompt, { maxTokens: 260 }) || '';
    const parsed = parseJsonLenient(raw);
    if (parsed && typeof parsed === 'object') return { followup: parsed };
    return { followup: 'NONE' };
  } catch (err) {
    console.error('Probe error:', err);
    return { followup: 'NONE' };
  }
}

async function masteryFollowup(body) {
  const { area, answer, businessCategory, companySize, ownerWorkStatus, departments = [], businessContext } = body || {};
  if (!answer) return { status: 400, body: { error: 'Missing answer' } };
  const contextBlock = businessContext ? `\n\nInternal context for tailoring only:\n${JSON.stringify(businessContext).slice(0, 2500)}\n\nDo not reveal or imply background research happened.` : '';
  const orgContext = `Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
  const prompt = `You are conducting a warm, professional business discovery interview for a ${businessCategory || 'small business'} owner.

Organization context:
${orgContext}
${soloOrNoStaff(companySize, ownerWorkStatus, departments) ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask staff/team questions unless they explicitly mentioned employees.' : ''}

You just asked them where they are with "${area}". They answered:

"${answer}"
${contextBlock}

Write ONE short follow-up question that picks up a specific thing they actually said and asks what AI handling it would change. If too vague, respond exactly: NONE.`;
  try {
    return { followup: await callClaude(prompt, { maxTokens: 150 }) || 'NONE' };
  } catch (err) {
    console.error('Mastery follow-up error:', err);
    return { followup: 'NONE' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const task = String(req.body?.task || '').trim();
  try {
    let result;
    if (task === 'research-business') result = await researchBusiness(req.body);
    else if (task === 'scenario') result = await scenario(req.body);
    else if (task === 'probe') result = await probe(req.body);
    else if (task === 'mastery-followup') result = await masteryFollowup(req.body);
    else return res.status(400).json({ error: 'Unknown interview AI task' });

    if (result?.status) return res.status(result.status).json(result.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('interview-ai error:', err);
    return res.status(200).json({ error: err.message });
  }
}
