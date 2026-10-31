import { buildIdentityRegistry, redactForModel, reidentify } from './identity-redaction.js';

export function anonymizeText(text, explicit = {}) {
  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText: explicit.participantText || text }));
  return {
    anonymizedText: result.text,
    mapping: result.mapping,
    stats: result.stats
  };
}

export function reidentifyText(text, mapping) {
  return reidentify(text, mapping);
}

export function privacyHeader() {
  return 'HERMES PRIVACY LAYER ACTIVE:\nThe source content below has been anonymized before model analysis. Use placeholders exactly as given when needed. Do not attempt to infer real names, emails, phone numbers, websites, addresses, account numbers, or identities behind placeholders.\n\n';
}
