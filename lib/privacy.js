import { buildIdentityRegistry, redactForModel, reidentify } from './identity-redaction.js';

export function anonymizeText(text, explicit = {}) {
  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText: explicit.participantText || text }));
  return {
    anonymizedText: result.text,
    mapping: result.mapping,
    stats: result.stats,
    ambiguous: result.ambiguous
  };
}

export function reidentifyText(text, mapping) {
  return reidentify(text, mapping);
}

export function privacyHeader(ambiguous = false) {
  const ambiguityNotice = ambiguous ? 'Some identity references were ambiguous and have been withheld. Do not infer or restore them.\n' : '';
  return `HERMES PRIVACY LAYER ACTIVE:\nThe source content below has been anonymized before model analysis. Use placeholders exactly as given when needed. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n${ambiguityNotice}\n`;
}
