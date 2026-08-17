import crypto from 'crypto';

const GATE_VERSION = 'privacy-gate-v1.0.0';

const CATEGORY_META = {
  direct_identifier: {
    label: 'Direct identifier',
    severity: 'medium',
    action: 'redact'
  },
  government_id: {
    label: 'Government ID',
    severity: 'high',
    action: 'quarantine'
  },
  payment_card: {
    label: 'Payment card',
    severity: 'high',
    action: 'quarantine'
  },
  bank_account: {
    label: 'Banking or financial account detail',
    severity: 'high',
    action: 'quarantine'
  },
  clinical: {
    label: 'Clinical or regulated health detail',
    severity: 'high',
    action: 'quarantine'
  },
  payroll: {
    label: 'Payroll or employee compensation detail',
    severity: 'high',
    action: 'quarantine'
  },
  customer_list: {
    label: 'Customer list or private customer data',
    severity: 'high',
    action: 'quarantine'
  },
  contract: {
    label: 'Supplier/customer contract detail',
    severity: 'high',
    action: 'quarantine'
  },
  invoice: {
    label: 'Invoice or private transaction detail',
    severity: 'medium',
    action: 'redact'
  },
  recipe_formula: {
    label: 'Recipe, formula, or confidential process',
    severity: 'high',
    action: 'quarantine'
  },
  confidential: {
    label: 'Confidential operating detail',
    severity: 'medium',
    action: 'redact'
  }
};

const KEYWORD_RULES = [
  {
    category: 'bank_account',
    pattern: /\b(?:bank account|account number|routing number|wire transfer|void cheque|void check|transit number|institution number|iban|swift|eft|ach)\b/gi
  },
  {
    category: 'clinical',
    pattern: /\b(?:patient|diagnosis|diagnosed|medication|prescription|medical record|chart note|clinical|clinic|doctor|physician|nurse practitioner|treatment plan|health card|lab result|hipaa|phipa)\b/gi
  },
  {
    category: 'payroll',
    pattern: /\b(?:payroll|salary|wage|hourly rate|employee pay|pay stub|paycheque|paycheck|t4|w-2|roe|benefits deduction|commission statement)\b/gi
  },
  {
    category: 'customer_list',
    pattern: /\b(?:customer list|client list|patient list|member list|subscriber list|customer names|client names|customer emails|client emails)\b/gi
  },
  {
    category: 'contract',
    pattern: /\b(?:supplier contract|customer contract|vendor contract|nda|non-disclosure|terms sheet|master service agreement|msa|confidential agreement)\b/gi
  },
  {
    category: 'invoice',
    pattern: /\b(?:invoice|invoice number|purchase order|po number|payment terms|accounts receivable|accounts payable)\b/gi
  },
  {
    category: 'recipe_formula',
    pattern: /\b(?:recipe|formula|formulation|ingredient ratio|secret sauce|proprietary blend|confidential process|batch sheet|production formula)\b/gi
  },
  {
    category: 'confidential',
    pattern: /\b(?:confidential|private financials|trade secret|proprietary|do not share|restricted data|sensitive file)\b/gi
  }
];

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function luhnValid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function excerptFor(text, start, end) {
  const source = String(text || '');
  const left = Math.max(0, start - 42);
  const right = Math.min(source.length, end + 42);
  return source.slice(left, right).replace(/\s+/g, ' ').trim();
}

function finding(category, match, start, end, sourceText, kind = 'pattern') {
  const meta = CATEGORY_META[category] || CATEGORY_META.confidential;
  return {
    id: `${category}_${start}_${end}_${hashValue(match).slice(0, 10)}`,
    category,
    label: meta.label,
    severity: meta.severity,
    action: meta.action,
    matchType: kind,
    start,
    end,
    length: end - start,
    valueHash: hashValue(match),
    contextPreview: excerptFor(sourceText, start, end)
  };
}

function collectPatternFindings(text) {
  const source = String(text || '');
  const findings = [];

  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const match of source.matchAll(emailRe)) {
    findings.push(finding('direct_identifier', match[0], match.index, match.index + match[0].length, source, 'email'));
  }

  const phoneRe = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
  for (const match of source.matchAll(phoneRe)) {
    findings.push(finding('direct_identifier', match[0], match.index, match.index + match[0].length, source, 'phone'));
  }

  const cardRe = /\b(?:\d[ -]*?){13,19}\b/g;
  for (const match of source.matchAll(cardRe)) {
    if (luhnValid(match[0])) {
      findings.push(finding('payment_card', match[0], match.index, match.index + match[0].length, source, 'luhn_payment_card'));
    } else {
      findings.push(finding('bank_account', match[0], match.index, match.index + match[0].length, source, 'long_account_like_number'));
    }
  }

  const sinSsnRe = /\b(?:\d{3}[-\s]?\d{2}[-\s]?\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/g;
  for (const match of source.matchAll(sinSsnRe)) {
    findings.push(finding('government_id', match[0], match.index, match.index + match[0].length, source, 'sin_ssn_like_number'));
  }

  for (const rule of KEYWORD_RULES) {
    for (const match of source.matchAll(rule.pattern)) {
      findings.push(finding(rule.category, match[0], match.index, match.index + match[0].length, source, 'keyword'));
    }
  }

  return resolveOverlappingFindings(dedupeFindings(findings));
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter(item => {
    const key = `${item.category}:${item.start}:${item.end}:${item.valueHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start - b.start || b.end - a.end);
}

function severityRank(value) {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function resolveOverlappingFindings(findings) {
  const ranked = [...findings].sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity);
    if (severity) return severity;
    const length = b.length - a.length;
    if (length) return length;
    return a.start - b.start;
  });
  const accepted = [];

  for (const item of ranked) {
    const overlaps = accepted.some(existing => item.start < existing.end && item.end > existing.start);
    if (!overlaps) accepted.push(item);
  }

  return accepted.sort((a, b) => a.start - b.start || b.end - a.end);
}

function redactText(text, findings) {
  let output = String(text || '');
  const redactionMap = [];
  const counters = {};
  const tokenById = new Map();

  for (const item of [...findings].sort((a, b) => a.start - b.start)) {
    counters[item.category] = (counters[item.category] || 0) + 1;
    const token = `[REDACTED_${item.category.toUpperCase()}_${counters[item.category]}]`;
    const original = String(text || '').slice(item.start, item.end);
    tokenById.set(item.id, token);
    redactionMap.push({
      token,
      category: item.category,
      label: item.label,
      severity: item.severity,
      action: item.action,
      original,
      originalHash: hashValue(original)
    });
  }

  const ordered = [...findings].sort((a, b) => b.start - a.start);
  for (const item of ordered) {
    const token = tokenById.get(item.id);
    output = output.slice(0, item.start) + token + output.slice(item.end);
  }

  return {
    sanitizedText: output,
    redactionMap
  };
}

function riskSummary(findings) {
  const categories = {};
  let high = 0;
  let medium = 0;
  for (const item of findings) {
    categories[item.category] = (categories[item.category] || 0) + 1;
    if (item.severity === 'high') high++;
    if (item.severity === 'medium') medium++;
  }
  const riskLevel = high ? 'high' : medium ? 'medium' : 'low';
  return {
    riskLevel,
    findingCount: findings.length,
    highRiskCount: high,
    mediumRiskCount: medium,
    categories
  };
}

function proofFindings(findings) {
  return findings.map(item => ({
    id: item.id,
    category: item.category,
    label: item.label,
    severity: item.severity,
    action: item.action,
    matchType: item.matchType,
    length: item.length,
    valueHash: item.valueHash,
    contextPreview: item.contextPreview
  }));
}

export function runPrivacyGate(text, options = {}) {
  const source = String(text || '');
  const purpose = String(options.purpose || 'ai_payload');
  const mode = String(process.env.BTAI_PRIVACY_GATE_MODE || options.mode || 'quarantine-high').toLowerCase();
  const findings = collectPatternFindings(source);
  const summary = riskSummary(findings);
  const redacted = redactText(source, findings);
  const requiresReview = summary.highRiskCount > 0 && mode !== 'sanitize-only';
  const decision = requiresReview ? 'quarantine' : 'allow_sanitized';

  return {
    gateVersion: GATE_VERSION,
    purpose,
    scannedAt: new Date().toISOString(),
    mode,
    decision,
    requiresReview,
    originalHash: hashValue(source),
    sanitizedHash: hashValue(redacted.sanitizedText),
    sanitizedText: redacted.sanitizedText,
    findings,
    proofFindings: proofFindings(findings),
    redactionMap: redacted.redactionMap,
    summary
  };
}

export function gateProofDetails(result, extra = {}) {
  return {
    privacyGateVersion: result.gateVersion,
    privacyProofType: 'privacy_gate',
    privacyGatePurpose: result.purpose,
    privacyGateDecision: result.decision,
    privacyGateRiskLevel: result.summary.riskLevel,
    privacyGateFindingCount: result.summary.findingCount,
    privacyGateHighRiskCount: result.summary.highRiskCount,
    privacyGateMediumRiskCount: result.summary.mediumRiskCount,
    privacyGateCategories: result.summary.categories,
    sanitizedAiPayloadCreated: true,
    redactionMapStoredEncrypted: true,
    rawSourcePreservedEncrypted: true,
    aiReceivesSanitizedPayloadOnly: result.decision !== 'quarantine',
    requiresAdminReview: result.requiresReview,
    proofStatus: result.decision === 'quarantine' ? 'review_required' : 'passed',
    ...extra
  };
}

export function publicGateSummary(result) {
  return {
    gateVersion: result.gateVersion,
    purpose: result.purpose,
    scannedAt: result.scannedAt,
    decision: result.decision,
    requiresReview: result.requiresReview,
    summary: result.summary,
    findings: result.proofFindings
  };
}
