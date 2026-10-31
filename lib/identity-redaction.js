// Shared, heuristic identity redaction for model-bound text. This module never
// writes source values to logs; callers retain the encrypted mapping only where
// their existing secure-record flow already does so.

const ALLOWLIST = new Set(['Google Sheets', 'QuickBooks', 'Red Deer', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Owner Name', 'Business Name']);
const ROLE_CUES = ['owner', 'founder', 'manager', 'sales', 'bookkeeper', 'accountant', 'admin', 'driver', 'buyer', 'customer', 'supplier'];
const ORG_SUFFIX = '(?:Ltd|Inc|Co|Corp|Foods|Farms|Bakery|Supply|Group)';

function clean(value) { return String(value || '').trim(); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tokenRole(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'PERSON'; }
function firstPart(value) { return clean(value).split(/\s+/)[0] || ''; }
function wholeReplace(text, value, token) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(value)})(?=$|[^A-Za-z0-9_])`, 'gi'), (_, lead) => `${lead}${token}`);
}
function add(mapping, entities, token, value, type, rung = 'known') {
  const source = clean(value);
  if (!source || mapping[token]) return;
  mapping[token] = source;
  entities.push({ token, type, rung, count: 0 });
}

export function buildIdentityRegistry({ identity = {}, declaredPeople = [], participantText = '' } = {}) {
  const owner = clean(identity.clientName || identity.ownerName || identity.name);
  const business = clean(identity.businessName);
  const website = clean(identity.websiteUrl || identity.website);
  const email = clean(identity.clientEmail || identity.email);
  const businessDescription = clean(identity.businessDescription || identity.businessCategory);
  const people = (Array.isArray(declaredPeople) ? declaredPeople : []).slice(0, 6).map((item, index) => ({
    label: clean(item?.label || item?.displayLabel || item?.name),
    fullName: clean(item?.fullName || item?.name),
    role: clean(item?.role),
    index
  })).filter(person => person.label || person.fullName);
  return { owner, business, website, email, businessDescription, people, participantText: clean(participantText) };
}

function detectEntities(participantText, registry, mapping, entities) {
  const knownFirstNames = new Set([firstPart(registry.owner), ...registry.people.map(person => firstPart(person.label || person.fullName))].filter(name => name.length >= 3).map(name => name.toLowerCase()));
  const explicit = [];
  const cuePattern = new RegExp(`\\b([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?)\\s+(?:in|is|,?\\s+the)\\s+(${ROLE_CUES.join('|')})\\b|\\b(?:our\\s+)?(${ROLE_CUES.join('|')})\\s+([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?)\\b`, 'g');
  let match;
  while ((match = cuePattern.exec(participantText))) {
    const name = clean(match[1] || match[4]);
    const role = clean(match[2] || match[3]);
    if (name && role) explicit.push({ name, role, surface: clean(match[0]) });
  }
  const orgPattern = new RegExp(`\\b([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)*\\s+${ORG_SUFFIX})\\b`, 'g');
  const orgs = [];
  while ((match = orgPattern.exec(participantText))) orgs.push(clean(match[1]));
  const names = [];
  const twoWords = /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g;
  while ((match = twoWords.exec(participantText))) {
    const name = clean(match[1]);
    if (!ALLOWLIST.has(name) && !orgs.includes(name)) names.push(name);
  }
  const singleCue = /\b(?:named|called|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+([A-Z][a-z]{2,})\b/g;
  while ((match = singleCue.exec(participantText))) names.push(clean(match[1]));

  for (const person of registry.people) {
    const token = `[PERSON_${tokenRole(person.role || person.label)}${person.index ? `_${person.index + 1}` : ''}]`;
    add(mapping, entities, token, person.fullName || person.label, 'person', 'declared');
  }
  for (const entry of explicit) {
    const token = `[PERSON_${tokenRole(entry.role)}]`;
    add(mapping, entities, token, entry.surface || entry.name, 'person', 'context');
  }
  for (const name of names) {
    if (Object.values(mapping).some(value => value.toLowerCase() === name.toLowerCase())) continue;
    const token = `[PERSON_${entities.filter(entity => entity.type === 'person').length + 1}]`;
    add(mapping, entities, token, name, 'person', 'detected');
  }
  for (const org of orgs) {
    const token = `[ORG_${entities.filter(entity => entity.type === 'org').length + 1}]`;
    add(mapping, entities, token, org, 'org', 'detected');
  }
  // A known first name is deliberately ambiguous unless an explicit role
  // resolved it above. This avoids attributing another Darren to the owner.
  for (const name of knownFirstNames) {
    const source = [...registry.people.map(person => firstPart(person.label || person.fullName)), firstPart(registry.owner)].find(value => value.toLowerCase() === name) || name;
    const roleToken = Object.entries(mapping).find(([token, value]) => token.startsWith('[PERSON_') && firstPart(value).toLowerCase() === name)?.[0];
    if (!roleToken) add(mapping, entities, `[PERSON_AMBIGUOUS_${entities.filter(entity => entity.type === 'ambiguous').length + 1}]`, source, 'ambiguous', 'fallback');
  }
}

function redactRegexIdentifiers(text, mapping, entities) {
  const replace = (source, pattern, prefix, type) => {
    let count = 0;
    return source.replace(pattern, value => {
      if (Object.values(mapping).includes(value)) return value;
      const token = `[${prefix}_${++count}]`;
      mapping[token] = value;
      entities.push({ token, type, rung: 'regex', count: 1 });
      return token;
    });
  };
  let result = text;
  result = replace(result, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'EMAIL', 'email');
  result = replace(result, /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, 'PHONE', 'phone');
  result = replace(result, /https?:\/\/[^\s)]+/gi, 'URL', 'url');
  result = replace(result, /\b[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ][ -]?\d[ABCEGHJKLMNPRSTVWXYZ]\d\b/gi, 'POSTAL_CODE', 'postalCode');
  result = replace(result, /\b(?:\d[ -]*?){13,19}\b/g, 'FINANCIAL_ACCOUNT', 'financialAccount');
  return result;
}

export function redactForModel(text, registry = buildIdentityRegistry()) {
  const source = String(text || '');
  const mapping = {};
  const entities = [];
  add(mapping, entities, '[OWNER_NAME]', registry.owner, 'owner');
  add(mapping, entities, '[BUSINESS_NAME]', registry.business, 'business');
  add(mapping, entities, '[WEBSITE_URL]', registry.website, 'url');
  add(mapping, entities, '[EMAIL_1]', registry.email, 'email');
  add(mapping, entities, '[BUSINESS_DESCRIPTION]', registry.businessDescription, 'business');
  detectEntities(registry.participantText, registry, mapping, entities);
  let redacted = source;
  Object.entries(mapping).sort((a, b) => b[1].length - a[1].length).forEach(([token, value]) => { redacted = wholeReplace(redacted, value, token); });
  redacted = redactRegexIdentifiers(redacted, mapping, entities);
  const stats = { detectionMode: 'heuristic', replacements: Object.keys(mapping).length };
  for (const entity of entities) stats[entity.type] = (stats[entity.type] || 0) + 1;
  return { text: redacted, mapping, entities, stats, ambiguous: entities.some(entity => entity.type === 'ambiguous') };
}

export function retokenizeWithMapping(text, mapping = {}) {
  let result = String(text || '');
  Object.entries(mapping).sort((a, b) => String(b[1]).length - String(a[1]).length).forEach(([token, value]) => { result = wholeReplace(result, value, token); });
  return result;
}

export function reidentify(text, mapping = {}) {
  let result = String(text || '');
  Object.entries(mapping).sort((a, b) => b[0].length - a[0].length).forEach(([token, value]) => {
    result = result.replace(new RegExp(escapeRegExp(token), 'gi'), value);
  });
  return result;
}
