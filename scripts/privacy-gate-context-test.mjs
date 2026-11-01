import assert from 'node:assert/strict';
import { runPrivacyGate } from '../lib/privacy-gate.js';
import { resolvePrivacyGates } from '../api/generate-dna.js';

function check(label, input, expected) {
  const result = runPrivacyGate(input, { purpose: 'privacy_gate_context_test' });
  assert.equal(result.requiresReview, expected.requiresReview, `${label}: requiresReview`);
  if (expected.includes) assert.match(result.sanitizedText, expected.includes, `${label}: sanitizedText includes`);
  if (expected.notIncludes) assert.doesNotMatch(result.sanitizedText, expected.notIncludes, `${label}: sanitizedText excludes`);
  if (expected.category) assert.ok(result.summary.categories[expected.category] >= 1, `${label}: category ${expected.category}`);
  if (expected.hardStopCount !== undefined) assert.equal(result.summary.hardStopCount, expected.hardStopCount, `${label}: hardStopCount`);
  return result;
}

check('payroll boundary mention passes', 'AI should not touch payroll. That should stay under human review.', {
  requiresReview: false,
  category: 'payroll',
  hardStopCount: 0,
  notIncludes: /REDACTED|GENERALIZED/
});

check('rounded payroll estimate passes', 'Our payroll is about $100,000 per year, just to show company size.', {
  requiresReview: false,
  category: 'payroll_amount',
  hardStopCount: 0,
  includes: /GENERALIZED_PAYROLL_AMOUNT_SIX_FIGURES/,
  notIncludes: /100,000/
});

check('exact payroll amount is generalized and continues', 'Payroll is $100,250.47 this year.', {
  requiresReview: false,
  category: 'payroll_amount',
  hardStopCount: 0,
  includes: /GENERALIZED_PAYROLL_AMOUNT_SIX_FIGURES/,
  notIncludes: /100,250\.47/
});

check('person near payroll is anonymized and continues', 'Most payroll goes through John Clampette and our annual wage number is $100,250.47.', {
  requiresReview: false,
  category: 'person_name',
  hardStopCount: 0,
  includes: /ANONYMIZED_PERSON/,
  notIncludes: /John Clampette|100,250\.47/
});

check('payroll records still require review', 'Here is our payroll spreadsheet with John Clampette making $83,247.19 and payroll deductions.', {
  requiresReview: true,
  category: 'payroll',
  includes: /REDACTED|ANONYMIZED|GENERALIZED/
});

check('bank account still requires review', 'The bank account number is 1234567890123456 for deposits.', {
  requiresReview: true,
  category: 'bank_account'
});

const staticSafetyPrompt = `
  Do not include payroll, confidential details, a customer list, a recipe, a supplier contract, or an invoice.
  Participant answer: I need help reducing repeated follow-up work after discovery calls.
`;
const staticSafetySource = 'Participant answer: I need help reducing repeated follow-up work after discovery calls.';
const staticSafetyResolution = resolvePrivacyGates(staticSafetyPrompt, staticSafetySource);
assert.equal(staticSafetyResolution.promptGate.requiresReview, true, 'full prompt safety wording is detected and sanitized');
assert.equal(staticSafetyResolution.participantGate.requiresReview, false, 'general participant answer does not require review');
assert.equal(staticSafetyResolution.gate.requiresReview, false, 'static prompt wording cannot block report delivery');
assert.equal(staticSafetyResolution.promptOnlyQuarantine, true, 'prompt-only quarantine is recorded for audit');
assert.doesNotMatch(staticSafetyResolution.sanitizedPrompt, /a customer list|a recipe|a supplier contract|an invoice/i, 'full prompt is still sanitized before the model call');

const actualSensitiveSource = 'Our customer list and supplier contract include private records.';
const actualSensitiveResolution = resolvePrivacyGates(`Safety rules. ${actualSensitiveSource}`, actualSensitiveSource);
assert.equal(actualSensitiveResolution.gate.requiresReview, true, 'actual participant-sensitive content still requires review');

console.log('privacy gate context tests passed');

