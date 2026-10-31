#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intakePage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.doesNotMatch(intakePage, /id="business-category"/, 'the retired category selector is not rendered');
assert.match(intakePage, /<label for="business-niche">What does your business do\?<\/label>/, 'the business-description field is clearly labelled');
assert.match(intakePage, /maxlength="160"/, 'the business description has a bounded saved value');
assert.match(intakePage, /businessCategory = businessNiche;/, 'new intakes keep the established API field compatible with the one description');
assert.match(intakePage, /const legacyCategory = LEGACY_CATEGORY_PACK_MAP\[businessCategory\]/, 'a legacy category is retained while a resumed draft is saved');
assert.match(intakePage, /!businessNiche \|\| !privacyConsent/, 'the business description is required before an interview starts');
assert.match(intakePage, /businessCategory, businessNiche, businessName, websiteUrl/, 'industry matching uses the business description');
assert.match(intakePage, /manufacturing_operations/, 'generic manufacturing has its own non-food tailoring pack');
assert.match(intakePage, /'bookkeeping'/, 'bookkeeping descriptions match the professional-services pack');
assert.match(intakePage, /Business Description: \$\{businessNiche \|\| businessCategory \|\| ''\}/, 'prompt context does not duplicate the same business description as a niche');

console.log('business-description intake contract tests passed');
