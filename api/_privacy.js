function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMapping(mapping, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!mapping[placeholder]) mapping[placeholder] = cleaned;
}

function extractField(text, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = String(text || '').match(re);
  return match ? match[1].trim() : '';
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

export function anonymizeText(text, explicit = {}) {
  let anonymized = String(text || '');
  const mapping = {};

  addMapping(mapping, '[OWNER_NAME]', explicit.clientName || explicit.ownerName || extractField(anonymized, 'Owner Name'));
  addMapping(mapping, '[BUSINESS_NAME]', explicit.businessName || extractField(anonymized, 'Business Name'));
  addMapping(mapping, '[WEBSITE_URL]', explicit.websiteUrl || extractField(anonymized, 'Website URL'));

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

  let accountCount = 0;
  anonymized = anonymized.replace(/\b(?:\d[ -]*?){13,19}\b/g, match => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    const placeholder = `[FINANCIAL_ACCOUNT_${++accountCount}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  return {
    anonymizedText: anonymized,
    mapping,
    stats: {
      replacements: Object.keys(mapping).length,
      emails: emailCount,
      phones: phoneCount,
      urls: urlCount,
      financialAccounts: accountCount
    }
  };
}

export function reidentifyText(text, mapping) {
  let output = String(text || '');
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

export function privacyHeader() {
  return 'HERMES PRIVACY LAYER ACTIVE:\nThe source content below has been anonymized before model analysis. Use placeholders exactly as given when needed. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n';
}
