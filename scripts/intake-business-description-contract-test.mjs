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
assert.match(intakePage, /businessCategory = businessNiche;/, 'the one description remains compatible with existing storage and API fields');
assert.match(intakePage, /!businessNiche \|\| !privacyConsent/, 'the business description is required before an interview starts');
assert.match(intakePage, /businessCategory, businessNiche, businessName, websiteUrl/, 'industry matching uses the business description');

console.log('business-description intake contract tests passed');
