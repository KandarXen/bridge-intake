#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildIdentityRegistry, redactForModel, reidentify } from '../lib/identity-redaction.js';

function redact(text, identity = {}, declaredPeople = []) {
  return redactForModel(text, buildIdentityRegistry({ identity, declaredPeople, participantText: text }));
}

let result = redact('Darren Randles approves quotes and Darren in sales sends them.', { clientName: 'Darren Randles' });
assert.match(result.text, /^\[OWNER_NAME\] approves quotes and \[PERSON_SALES\] sends them\.$/);

result = redact('Darren handles the quotes.', { clientName: 'Darren Randles' });
assert.match(result.text, /^\[PERSON_AMBIGUOUS_1\] handles the quotes\.$/);

result = redact('Darren M. handles the quotes.', { clientName: 'Darren Randles' }, [{ label: 'Darren M.', role: 'sales manager' }]);
assert.match(result.text, /^\[PERSON_SALES_MANAGER\] handles the quotes\.$/);

result = redact('Sarah Nguyen at Acme Foods orders weekly.', {});
assert.match(result.text, /\[PERSON_1\] at \[ORG_1\] orders weekly\./);

result = redact("Darren's quotes, DARREN, Darren.", { clientName: 'Darren Randles' });
assert.doesNotMatch(result.text, /Darren/i);

result = redact('Google Sheets in Red Deer every Monday uses QuickBooks; mark the date.', {});
assert.match(result.text, /Google Sheets in Red Deer every Monday uses QuickBooks; mark the date\./);

result = redact('Mail T4N 1A1 to owner@example.test.', {});
assert.match(result.text, /\[POSTAL_CODE_1\]/);
assert.match(result.text, /\[EMAIL_1\]/);

assert.equal(reidentify('[person_sales_manager] and [PERSON_1]', { '[PERSON_SALES_MANAGER]': 'Darren M.', '[PERSON_1]': 'Sarah Nguyen' }), 'Darren M. and Sarah Nguyen');

console.log('identity redaction tests passed');
