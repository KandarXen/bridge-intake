// api/generate-dna.js
// Server-side function that calls Claude to compile the DNA file.
// Keeps the Anthropic API key hidden from the browser.
// Hermes privacy layer: anonymizes obvious identifiers before sending the
// prompt to Claude, then re-identifies the final output before returning it.

import { encryptJson } from '../lib/crypto.js';
import { insertClaimTrace, insertIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { validateDnaOutput } from '../lib/validate-output.js';

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

function anonymizePrompt(prompt) {
  const mapping = {};

  addMapping(mapping, '[OWNER_NAME]', extractField(prompt, 'Owner Name'));
  addMapping(mapping, '[BUSINESS_NAME]', extractField(prompt, 'Business Name'));
  addMapping(mapping, '[BUSINESS_CATEGORY]', extractField(prompt, 'Business Category'));
  addMapping(mapping, '[WEBSITE_URL]', extractField(prompt, 'Website URL'));

  let anonymized = prompt;

  Object.entries(mapping)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([placeholder, value]) => {
      anonymized = replaceAllLiteral(anonymized, value, placeholder);
    });

  let emailCount = 0;
  anonymized = anonymized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, match => {
    const placeholder = `[EMAIL_${++emailCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let phoneCount = 0;
  anonymized = anonymized.replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, match => {
    const placeholder = `[PHONE_${++phoneCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let urlCount = 0;
  anonymized = anonymized.replace(/https?:\/\/[^\s)]+/gi, match => {
    if (Object.values(mapping).includes(match)) return '[WEBSITE_URL]';
    const placeholder = `[URL_${++urlCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  let moneyAccountCount = 0;
  anonymized = anonymized.replace(/\b(?:\d[ -]*?){13,19}\b/g, match => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    const placeholder = `[FINANCIAL_ACCOUNT_${++moneyAccountCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  const privacyHeader = `HERMES PRIVACY LAYER ACTIVE:\nThe source interview below has been anonymized before model analysis. Use placeholders exactly as given. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n`;

  return {
    anonymizedPrompt: privacyHeader + anonymized,
    mapping,
    stats: {
      replacements: Object.keys(mapping).length,
      emails: emailCount,
      phones: phoneCount,
      urls: urlCount,
      financialAccounts: moneyAccountCount
    }
  };
}

function reidentifyText(text, mapping) {
  let output = text || '';
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

async function saveAnonymizationMapping(clientDraftId, mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for mapping storage' };

    const business = mapping['[BUSINESS_NAME]'] || 'Client_Business';
    const safeBusiness = business.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const content = {
      createdAt: new Date().toISOString(),
      warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
      label: `${safeBusiness}_HERMES_PRIVATE_MAPPING_${dateStr}.json`,
      stats,
      mapping
    };

    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'hermes_reidentification_map',
      encrypted_payload: encryptJson(content)
    });
    return { saved: true, fileId: row?.id || '', link: '' };
  } catch (err) {
    console.error('Hermes mapping save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function saveCompletedDna(clientDraftId, dnaContent, meta = {}) {
  try {
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for output storage' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'venture_dna_markdown',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        dnaContent,
        meta
      })
    });
    await updateIntakeSession(clientDraftId, {
      status: 'complete',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    console.error('Completed DNA secure save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function saveClaimTrace(clientDraftId, validation) {
  try {
    if (!clientDraftId || !validation?.claims?.length) return { saved: false, reason: 'No evidence-labelled claims found' };
    await Promise.all(validation.claims.map(claim => insertClaimTrace({
      client_draft_id: clientDraftId,
      report_section: claim.reportSection,
      claim_text: claim.claimText,
      evidence_type: claim.evidenceType,
      source_question_id: '',
      source_excerpt: '',
      confidence: null
    })));
    return { saved: true, count: validation.claims.length };
  } catch (err) {
    console.error('Claim trace save failed:', err);
    return { saved: false, reason: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, clientDraftId, sourceMeta } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const hermesPrivacy = anonymizePrompt(prompt);
    const mappingSave = await saveAnonymizationMapping(clientDraftId, hermesPrivacy.mapping, hermesPrivacy.stats);
    const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
    let fullText = '';
    let stopReason = null;
    let passes = 0;
    const MAX_PASSES = 4;

    do {
      const data = await callClaude(messages);
      const piece = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
      fullText += piece;
      stopReason = data.stop_reason;
      passes++;

      if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
        messages.push({ role: 'assistant', content: piece });
        messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
      } else {
        break;
      }
    } while (passes < MAX_PASSES);

    const truncated = (stopReason === 'max_tokens');
    if (truncated) {
      fullText += '\n\n> NOTE TO DARREN: This DNA file reached the maximum generation length. The content above is complete through where it stops; regenerate or extend manually if a later section is cut.';
    }

    const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);
    const validation = validateDnaOutput(reidentifiedText, sourceMeta || {});
    const claimTraceSave = await saveClaimTrace(clientDraftId, validation);
    const outputSave = await saveCompletedDna(clientDraftId, reidentifiedText, {
      truncated,
      sourceMeta: sourceMeta || {},
      anonymizationStats: hermesPrivacy.stats,
      validation: {
        ...validation,
        claimTraceSaved: !!claimTraceSave.saved,
        claimTraceCount: claimTraceSave.count || 0,
        claimTraceReason: claimTraceSave.reason || ''
      }
    });

    return res.status(200).json({
      dnaContent: reidentifiedText,
      truncated,
      secureStorage: {
        saved: !!outputSave.saved,
        outputId: outputSave.outputId || '',
        reason: outputSave.reason || '',
        validation: {
          ...validation,
          claimTraceSaved: !!claimTraceSave.saved,
          claimTraceCount: claimTraceSave.count || 0,
          claimTraceReason: claimTraceSave.reason || ''
        }
      },
      hermesPrivacy: {
        anonymized: true,
        stats: hermesPrivacy.stats,
        mappingSaved: !!mappingSave.saved,
        mappingSaveReason: mappingSave.reason || '',
        mappingFileId: mappingSave.fileId || ''
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

