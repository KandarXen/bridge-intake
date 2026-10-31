// Shared, heuristic identity redaction for model-bound text. It is deliberately
// conservative: participant answers are scanned, never prompt templates.

const ALLOWLIST = new Set([
  'Google Sheets', 'Google Drive', 'Microsoft Excel', 'QuickBooks', 'Red Deer',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December', 'Owner Name', 'Business Name',
  'Business Description', 'Workflow Friction', 'Information Readiness',
  'Human Review Boundary', 'First Useful Win', 'AI Fit', 'Privacy Certificate',
  'Customer Service', 'Facebook Ads', 'Calgary Alberta', 'Uses Facebook'
]);
const ROLE_CUES = ['owner', 'founder', 'manager', 'sales', 'bookkeeper', 'accountant', 'admin', 'driver', 'buyer', 'customer', 'supplier'];
const ORG_SUFFIX = '(?:Ltd|Inc|Co|Corp|Foods|Farms|Bakery|Supply|Group)';
const NON_NAME_WORDS = new Set(['Pricing', 'Quoting', 'Orders', 'Invoices', 'Uses', 'Customer', 'Service']);

function clean(value) { return String(value || '').trim(); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tokenRole(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'PERSON'; }
function nameParts(value) { return clean(value).split(/\s+/).filter(part => /^[A-Z][a-z]{2,}$|^[A-Z]{3,}$/.test(part)); }
function isNameShaped(value) { return /^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?$|^[A-Z]{3,}(?:\s+[A-Z]{3,})?$/.test(clean(value)); }
function isDeclaredName(value) { return /^[A-Z][a-z]{2,}(?:\s+(?:[A-Z][a-z]{2,}|[A-Z]\.))?$|^[A-Z]{3,}(?:\s+[A-Z]{3,})?$/.test(clean(value)); }
function isLikelyPersonName(value) { return isNameShaped(value) && !nameParts(value).some(part => NON_NAME_WORDS.has(part)); }
function personValues(name, surface = '') {
  const parts = nameParts(name);
  const hasInitial = /\b[A-Z]\.$/.test(clean(name));
  const safeParts = parts.filter(part => !ALLOWLIST.has(part));
  return [surface, name, String(name).toUpperCase(), ...(hasInitial ? [] : safeParts.flatMap(part => [part, part.toUpperCase()]))].filter(Boolean);
}
function hasBareNameMention(text, part, fullName) {
  const withoutFullName = String(text || '').replace(new RegExp(escapeRegExp(fullName), 'gi'), '');
  return new RegExp(`(^|[^A-Za-z0-9_])(?:${escapeRegExp(part)}|${escapeRegExp(String(part).toUpperCase())})(?=$|[^A-Za-z0-9_])`, 'g').test(withoutFullName);
}
function add(mapping, entities, token, value, type, rung = 'known') {
  const source = clean(value);
  if (!source || mapping[token]) return false;
  mapping[token] = source;
  entities.push({ token, type, rung, count: 0 });
  return true;
}
function nextToken(prefix, mapping) {
  let n = 1;
  while (mapping[`[${prefix}_${n}]`]) n += 1;
  return `[${prefix}_${n}]`;
}
function replaceLiteral(text, value, token, { insensitive = false } = {}) {
  if (!value || value.length < 2) return { text, count: 0 };
  let count = 0;
  const output = text.replace(new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(value)})(?=$|[^A-Za-z0-9_])`, insensitive ? 'gi' : 'g'), (_, lead) => {
    count += 1;
    return `${lead}${token}`;
  });
  return { text: output, count };
}

export function buildIdentityRegistry({ identity = {}, declaredPeople = [], participantText = '' } = {}) {
  const owner = clean(identity.clientName || identity.ownerName || identity.name);
  const business = clean(identity.businessName);
  const website = clean(identity.websiteUrl || identity.website);
  const email = clean(identity.clientEmail || identity.email);
  const businessDescription = clean(identity.businessDescription || identity.businessCategory);
  const people = (Array.isArray(declaredPeople) ? declaredPeople : []).slice(0, 6).map((item, index) => ({
    label: clean(item?.label || item?.displayLabel || item?.name), fullName: clean(item?.fullName || item?.name), role: clean(item?.role), index
  })).filter(person => person.label || person.fullName);
  return { owner, business, website, email, businessDescription, people, participantText: clean(participantText) };
}

function detectEntities(participantText, registry, mapping, entities) {
  const replacements = [];
  const addPerson = (name, role, surface, rung) => {
    if (!isLikelyPersonName(name) || ALLOWLIST.has(name)) return;
    if (nameParts(registry.owner).includes(name)) return;
    const token = nextToken(`PERSON_${tokenRole(role)}`, mapping);
    if (add(mapping, entities, token, name, 'person', rung)) replacements.push({ token, values: personValues(name, surface) });
  };
  const cuePattern = new RegExp(`\\b([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?|[A-Z]{3,}(?:\\s+[A-Z]{3,})?)\\s+(?:in|,?\\s+the)\\s+(${ROLE_CUES.join('|')})\\b|\\b(?:our\\s+)?(${ROLE_CUES.join('|')})\\s+([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?|[A-Z]{3,}(?:\\s+[A-Z]{3,})?)\\b`, 'g');
  let match;
  while ((match = cuePattern.exec(participantText))) addPerson(clean(match[1] || match[4]), clean(match[2] || match[3]), clean(match[0]), 'context');
  const possessiveCue = new RegExp(`\\b([A-Z][a-z]{2,}|[A-Z]{3,}),\\s+the\\s+(${ROLE_CUES.join('|')})\\b`, 'g');
  while ((match = possessiveCue.exec(participantText))) addPerson(clean(match[1]), clean(match[2]), clean(match[0]), 'context');
  for (const person of registry.people) {
    const name = person.fullName || person.label;
    if (!isDeclaredName(name)) continue;
    const token = nextToken(`PERSON_${tokenRole(person.role || person.label)}`, mapping);
    if (add(mapping, entities, token, name, 'person', 'declared')) replacements.push({ token, values: personValues(name) });
  }
  if (isNameShaped(registry.owner)) {
    add(mapping, entities, '[OWNER_NAME]', registry.owner, 'owner');
    const ownerParts = nameParts(registry.owner);
    replacements.push({ token: '[OWNER_NAME]', values: [registry.owner, String(registry.owner).toUpperCase(), ...ownerParts.slice(1).flatMap(part => [part, part.toUpperCase()])] });
    // A bare first name can refer to the owner or another person. Withhold it
    // rather than silently merging it into the owner in the restored report.
    if (ownerParts[0] && hasBareNameMention(participantText, ownerParts[0], registry.owner)) {
      const token = nextToken('PERSON_AMBIGUOUS', mapping);
      if (add(mapping, entities, token, ownerParts[0], 'ambiguous', 'fallback')) replacements.push({ token, values: [ownerParts[0], ownerParts[0].toUpperCase()] });
    }
  }
  const orgPattern = new RegExp(`\\b([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)*\\s+${ORG_SUFFIX})\\b`, 'g');
  while ((match = orgPattern.exec(participantText))) {
    const org = clean(match[1]);
    if (ALLOWLIST.has(org)) continue;
    const token = nextToken('ORG', mapping);
    if (add(mapping, entities, token, org, 'org', 'detected')) replacements.push({ token, values: [org] });
  }
  const fullName = /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g;
  while ((match = fullName.exec(participantText))) {
    const name = clean(match[1]);
    if (ALLOWLIST.has(name) || Object.values(mapping).some(value => value === name)) continue;
    addPerson(name, 'detected', name, 'detected');
  }
  const named = /\b(?:named|called|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+([A-Z][a-z]{2,}|[A-Z]{3,})\b/g;
  while ((match = named.exec(participantText))) addPerson(clean(match[1]), 'detected', clean(match[1]), 'detected');
  return replacements;
}

function redactRegexIdentifiers(text, mapping, entities) {
  let total = 0;
  const replace = (pattern, prefix, type) => {
    text = text.replace(pattern, value => {
      if (Object.values(mapping).includes(value)) return value;
      const token = nextToken(prefix, mapping);
      mapping[token] = value; entities.push({ token, type, rung: 'regex', count: 1 }); total += 1;
      return token;
    });
  };
  replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'EMAIL', 'email');
  replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, 'PHONE', 'phone');
  replace(/https?:\/\/[^\s)]+/gi, 'URL', 'url');
  replace(/\b[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ][ -]?\d[ABCEGHJKLMNPRSTVWXYZ]\d\b/gi, 'POSTAL_CODE', 'postalCode');
  replace(/\b(?:\d[ -]*?){13,19}\b/g, 'FINANCIAL_ACCOUNT', 'financialAccount');
  return { text, count: total };
}

export function redactForModel(text, registry = buildIdentityRegistry()) {
  const source = String(text || '');
  const mapping = {}; const entities = []; let redacted = source; let replacements = 0;
  add(mapping, entities, '[BUSINESS_NAME]', registry.business, 'business');
  add(mapping, entities, '[WEBSITE_URL]', registry.website, 'url');
  add(mapping, entities, '[OWNER_EMAIL]', registry.email, 'email');
  add(mapping, entities, '[BUSINESS_DESCRIPTION]', registry.businessDescription, 'business');
  const entityReplacements = detectEntities(registry.participantText, registry, mapping, entities);
  const standard = [['[BUSINESS_NAME]', registry.business, true], ['[WEBSITE_URL]', registry.website, true], ['[OWNER_EMAIL]', registry.email, true], ['[BUSINESS_DESCRIPTION]', registry.businessDescription, true]];
  for (const [token, value, insensitive] of standard.sort((a, b) => b[1].length - a[1].length)) {
    const result = replaceLiteral(redacted, value, token, { insensitive }); redacted = result.text; replacements += result.count;
  }
  for (const entry of entityReplacements) for (const value of [...new Set(entry.values)].sort((a, b) => b.length - a.length)) {
    const result = replaceLiteral(redacted, value, entry.token, { insensitive: /\s/.test(value) }); redacted = result.text; replacements += result.count;
  }
  const regex = redactRegexIdentifiers(redacted, mapping, entities); redacted = regex.text; replacements += regex.count;
  const stats = { detectionMode: 'heuristic', replacements, mappedIdentifiers: Object.keys(mapping).length };
  for (const entity of entities) stats[entity.type] = (stats[entity.type] || 0) + 1;
  return { text: redacted, mapping, entities, stats, ambiguous: entities.some(entity => entity.type === 'ambiguous') };
}

export function retokenizeWithMapping(text, mapping = {}) {
  let result = String(text || '');
  Object.entries(mapping).sort((a, b) => String(b[1]).length - String(a[1]).length).forEach(([token, value]) => { result = replaceLiteral(result, value, token, { insensitive: !token.includes('PERSON') && !token.includes('OWNER_NAME') }).text; });
  return result;
}
export function reidentify(text, mapping = {}) {
  let result = String(text || '');
  Object.entries(mapping).sort((a, b) => b[0].length - a[0].length).forEach(([token, value]) => { result = result.replace(new RegExp(escapeRegExp(token), 'gi'), value); });
  return result;
}
