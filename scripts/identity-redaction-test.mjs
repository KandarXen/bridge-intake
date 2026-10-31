#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildIdentityRegistry, redactForModel, reidentify } from '../lib/identity-redaction.js';

function redact(text, identity = {}, declaredPeople = []) {
  return redactForModel(text, buildIdentityRegistry({ identity, declaredPeople, participantText: text }));
}

let result = redact('Darren Randles approves quotes and Darren in sales sends them.', { clientName: 'Darren Randles' });
assert.match(result.text, /^\[OWNER_NAME\] approves quotes and \[PERSON_AMBIGUOUS_1\] in sales sends them\.$/);

result = redact('Darren handles the quotes. Randles approves them. darren is an ordinary word.', { clientName: 'Darren Randles' });
assert.match(result.text, /^\[PERSON_AMBIGUOUS_1\] handles the quotes\. \[OWNER_NAME\] approves them\. darren is an ordinary word\.$/);

result = redact('Sarah Miles handles the quotes.', { clientName: 'Darren Randles' }, [{ label: 'Sarah Miles', role: 'sales manager' }]);
assert.match(result.text, /^\[PERSON_SALES_MANAGER_1\] handles the quotes\.$/);

result = redact('Sarah Nguyen at Acme Foods orders weekly.', {});
assert.match(result.text, /\[PERSON_DETECTED_1\] at \[ORG_1\] orders weekly\./);

result = redact('Sarah Nguyen at Acme Foods orders weekly. Sarah called again. Nguyen wants a discount. SARAH NGUYEN too.', {});
assert.doesNotMatch(result.text, /Sarah|Nguyen/i, 'every detected-person form stays out of model-bound text');

result = redact('Darren the owner approves. Darren in sales sends quotes. Darren M. handles shipping.', { clientName: 'Darren Randles' }, [{ label: 'Darren M.', role: 'sales manager' }]);
assert.match(result.text, /^\[PERSON_AMBIGUOUS_1\] the owner approves\. \[PERSON_AMBIGUOUS_1\] in sales sends quotes\. \[PERSON_SALES_MANAGER_1\] handles shipping\.$/);

result = redact('DARREN RANDLES and darren randles.', { clientName: 'Darren Randles' });
assert.match(result.text, /^\[OWNER_NAME\] and \[OWNER_NAME\]\.$/, 'multi-word known names match case-insensitively');

result = redact('May Chan joined in May.', {});
assert.match(result.text, /^\[PERSON_DETECTED_1\] joined in May\.$/, 'a detected name does not replace an ordinary month mention');

result = redact("Darren's quotes, DARREN, Darren.", { clientName: 'Darren Randles' });
assert.doesNotMatch(result.text, /Darren/i);

result = redact('Darren in sales checks orders. Sarah in sales submits them. Sarah then calls Darren.', {});
assert.doesNotMatch(result.text, /Darren|Sarah/);
assert.match(result.text, /\[PERSON_SALES_1\].*\[PERSON_SALES_2\].*\[PERSON_SALES_2\].*\[PERSON_SALES_1\]/);

result = redact('Pricing is owner decided. Google Drive and Microsoft Excel track the workflow.', {});
assert.match(result.text, /Pricing is owner decided\. Google Drive and Microsoft Excel track the workflow\./);

result = redact('Google Sheets in Red Deer every Monday uses QuickBooks; mark the date.', {});
assert.match(result.text, /Google Sheets in Red Deer every Monday uses QuickBooks; mark the date\./);

result = redact('Mail T4N 1A1 to owner@example.test.', {});
assert.match(result.text, /\[POSTAL_CODE_1\]/);
assert.match(result.text, /\[EMAIL_1\]/);

assert.equal(reidentify('[person_sales_manager] and [PERSON_1]', { '[PERSON_SALES_MANAGER]': 'Darren M.', '[PERSON_1]': 'Sarah Nguyen' }), 'Darren M. and Sarah Nguyen');

console.log('identity redaction tests passed');
