# BTAI Intake v1.72.32 — Complete independent Claude QA packet

> This is a self-contained evidence packet. Review this packet only. Do not use connectors, repository access, a live URL, or external systems. Do not change code, deploy, alter settings, send email, submit an intake, or make an AI call.

## Review target

- Baseline: `4731a9e`
- Candidate: `dc0fddc8ee32adecf839071b3939f58f9acadf71`
- Branch: `release/v1.72.24-secure-intake`
- Private Preview: Vercel-protected; no live-browser observation is required for this code review.
- Production: unchanged at v1.72.23 on `main`.
- Scope: correct v1.72.31 review-001 B1, I1–I3, and R4 evidence coverage without changing delivery, email, credentials, AI enablement, access settings, or Production.

## Required review response

Return exactly these sections: **Release posture**, **What was verified**, **Blockers**, **Important before broader tester use**, **Non-blocking observations**, **Safety regression result**, **Evidence gap, if any**, and **One recommendation**.

Use file and line citations from this packet. Do not infer unspecified behavior. Do not treat missing live-browser or environment-only evidence as a code blocker; list it separately as an evidence gap.

## Resolution claims to verify

| Prior finding | Candidate claim |
| --- | --- |
| B1 | A detected third-party full name, first name, surname, and all-caps form all receive placeholders. |
| I1 | Bare owner first names are explicitly ambiguous; declared names with initials are handled as declared people. |
| I2 | Known multi-word names match case-insensitively while ordinary lower-case words remain unchanged. |
| I3 | An empty `participantText` disables heuristic detection instead of scanning the prompt template. |
| R4 evidence | The scoped lookup contract test asserts both draft ID and output type in the request URL. |

## Exact candidate diff

```diff
diff --git a/api/report-pack.js b/api/report-pack.js
index 6cdff3f..611c80e 100644
--- a/api/report-pack.js
+++ b/api/report-pack.js
@@ -8,7 +8,7 @@ import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError
 import { assertDraftAccess } from '../lib/draft-access.js';
 import { buildIdentityRegistry, redactForModel, reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';
 
-const APP_VERSION = 'v1.72.31';
+const APP_VERSION = 'v1.72.32';
 
 const REPORTS = {
   free: {
diff --git a/docs/releases/v1.72.32/README.md b/docs/releases/v1.72.32/README.md
new file mode 100644
index 0000000..b8d2a43
--- /dev/null
+++ b/docs/releases/v1.72.32/README.md
@@ -0,0 +1,28 @@
+# BTAI Intake v1.72.32 — identity-boundary corrective candidate
+
+## Release boundary
+
+Private Preview candidate only. Production remains v1.72.23 on `main`. This
+candidate does not alter report delivery, email gates, credentials, AI
+enablement, access controls, or wider tester access.
+
+## Corrective scope
+
+This candidate responds to the independent v1.72.31 review:
+
+- A detected third-party name is tokenized in its full-name, first-name,
+  surname, and all-caps forms.
+- A bare owner first name is marked ambiguous rather than being restored as the
+  owner. Declared people with an initial, such as `Darren M.`, keep a separate
+  token.
+- Multi-word known names match case-insensitively; a lower-case ordinary word
+  does not become a name match.
+- An explicitly empty participant-text value disables heuristic detection, so
+  generated prompt headings cannot be mistaken for participant names.
+- The report-map test now asserts draft-ID and output-type query scoping.
+
+## Release gate
+
+Do not widen testers until Claude independently reviews the complete v1.72.32
+packet. This is a heuristic privacy layer, not a claim of perfect identity
+detection or a legal privacy conclusion.
diff --git a/index.html b/index.html
index 75328a3..7a75e6f 100644
--- a/index.html
+++ b/index.html
@@ -2148,7 +2148,7 @@
   </div>
   <div class="header-tag-wrap">
     <span class="header-tag" id="header-tag">Business Discovery Session</span>
-      <span class="header-version">v1.72.31 Preview</span>
+      <span class="header-version">v1.72.32 Preview</span>
   </div>
 </header>
 
diff --git a/lib/identity-redaction.js b/lib/identity-redaction.js
index a0c4131..2c2be3a 100644
--- a/lib/identity-redaction.js
+++ b/lib/identity-redaction.js
@@ -7,16 +7,25 @@ const ALLOWLIST = new Set([
   'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
   'September', 'October', 'November', 'December', 'Owner Name', 'Business Name',
   'Business Description', 'Workflow Friction', 'Information Readiness',
-  'Human Review Boundary', 'First Useful Win', 'AI Fit', 'Privacy Certificate'
+  'Human Review Boundary', 'First Useful Win', 'AI Fit', 'Privacy Certificate',
+  'Customer Service', 'Facebook Ads', 'Calgary Alberta', 'Uses Facebook'
 ]);
 const ROLE_CUES = ['owner', 'founder', 'manager', 'sales', 'bookkeeper', 'accountant', 'admin', 'driver', 'buyer', 'customer', 'supplier'];
 const ORG_SUFFIX = '(?:Ltd|Inc|Co|Corp|Foods|Farms|Bakery|Supply|Group)';
+const NON_NAME_WORDS = new Set(['Pricing', 'Quoting', 'Orders', 'Invoices', 'Uses', 'Customer', 'Service']);
 
 function clean(value) { return String(value || '').trim(); }
 function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
 function tokenRole(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'PERSON'; }
 function nameParts(value) { return clean(value).split(/\s+/).filter(part => /^[A-Z][a-z]{2,}$|^[A-Z]{3,}$/.test(part)); }
 function isNameShaped(value) { return /^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?$|^[A-Z]{3,}(?:\s+[A-Z]{3,})?$/.test(clean(value)); }
+function isDeclaredName(value) { return /^[A-Z][a-z]{2,}(?:\s+(?:[A-Z][a-z]{2,}|[A-Z]\.))?$|^[A-Z]{3,}(?:\s+[A-Z]{3,})?$/.test(clean(value)); }
+function isLikelyPersonName(value) { return isNameShaped(value) && !nameParts(value).some(part => NON_NAME_WORDS.has(part)); }
+function personValues(name, surface = '') {
+  const parts = nameParts(name);
+  const hasInitial = /\b[A-Z]\.$/.test(clean(name));
+  return [surface, name, String(name).toUpperCase(), ...(hasInitial ? [] : parts.flatMap(part => [part, part.toUpperCase()]))].filter(Boolean);
+}
 function add(mapping, entities, token, value, type, rung = 'known') {
   const source = clean(value);
   if (!source || mapping[token]) return false;
@@ -54,12 +63,10 @@ export function buildIdentityRegistry({ identity = {}, declaredPeople = [], part
 function detectEntities(participantText, registry, mapping, entities) {
   const replacements = [];
   const addPerson = (name, role, surface, rung) => {
-    if (!isNameShaped(name) || ALLOWLIST.has(name)) return;
-    // A known owner keeps the stable owner token even when an answer adds a
-    // role cue such as "Darren in sales".
+    if (!isLikelyPersonName(name) || ALLOWLIST.has(name)) return;
     if (nameParts(registry.owner).includes(name)) return;
     const token = nextToken(`PERSON_${tokenRole(role)}`, mapping);
-    if (add(mapping, entities, token, name, 'person', rung)) replacements.push({ token, values: [surface, name] });
+    if (add(mapping, entities, token, name, 'person', rung)) replacements.push({ token, values: personValues(name, surface) });
   };
   const cuePattern = new RegExp(`\\b([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?|[A-Z]{3,}(?:\\s+[A-Z]{3,})?)\\s+(?:in|,?\\s+the)\\s+(${ROLE_CUES.join('|')})\\b|\\b(?:our\\s+)?(${ROLE_CUES.join('|')})\\s+([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?|[A-Z]{3,}(?:\\s+[A-Z]{3,})?)\\b`, 'g');
   let match;
@@ -68,13 +75,20 @@ function detectEntities(participantText, registry, mapping, entities) {
   while ((match = possessiveCue.exec(participantText))) addPerson(clean(match[1]), clean(match[2]), clean(match[0]), 'context');
   for (const person of registry.people) {
     const name = person.fullName || person.label;
-    if (!isNameShaped(name)) continue;
+    if (!isDeclaredName(name)) continue;
     const token = nextToken(`PERSON_${tokenRole(person.role || person.label)}`, mapping);
-    if (add(mapping, entities, token, name, 'person', 'declared')) replacements.push({ token, values: [name, ...nameParts(name).flatMap(part => [part, part.toUpperCase()])] });
+    if (add(mapping, entities, token, name, 'person', 'declared')) replacements.push({ token, values: personValues(name) });
   }
   if (isNameShaped(registry.owner)) {
     add(mapping, entities, '[OWNER_NAME]', registry.owner, 'owner');
-    replacements.push({ token: '[OWNER_NAME]', values: [registry.owner, ...nameParts(registry.owner).flatMap(part => [part, part.toUpperCase()])] });
+    const ownerParts = nameParts(registry.owner);
+    replacements.push({ token: '[OWNER_NAME]', values: [registry.owner, String(registry.owner).toUpperCase(), ...ownerParts.slice(1).flatMap(part => [part, part.toUpperCase()])] });
+    // A bare first name can refer to the owner or another person. Withhold it
+    // rather than silently merging it into the owner in the restored report.
+    if (ownerParts[0]) {
+      const token = nextToken('PERSON_AMBIGUOUS', mapping);
+      if (add(mapping, entities, token, ownerParts[0], 'ambiguous', 'fallback')) replacements.push({ token, values: [ownerParts[0], ownerParts[0].toUpperCase()] });
+    }
   }
   const orgPattern = new RegExp(`\\b([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)*\\s+${ORG_SUFFIX})\\b`, 'g');
   while ((match = orgPattern.exec(participantText))) {
@@ -125,12 +139,12 @@ export function redactForModel(text, registry = buildIdentityRegistry()) {
     const result = replaceLiteral(redacted, value, token, { insensitive }); redacted = result.text; replacements += result.count;
   }
   for (const entry of entityReplacements) for (const value of [...new Set(entry.values)].sort((a, b) => b.length - a.length)) {
-    const result = replaceLiteral(redacted, value, entry.token); redacted = result.text; replacements += result.count;
+    const result = replaceLiteral(redacted, value, entry.token, { insensitive: /\s/.test(value) }); redacted = result.text; replacements += result.count;
   }
   const regex = redactRegexIdentifiers(redacted, mapping, entities); redacted = regex.text; replacements += regex.count;
   const stats = { detectionMode: 'heuristic', replacements, mappedIdentifiers: Object.keys(mapping).length };
   for (const entity of entities) stats[entity.type] = (stats[entity.type] || 0) + 1;
-  return { text: redacted, mapping, entities, stats, ambiguous: false };
+  return { text: redacted, mapping, entities, stats, ambiguous: entities.some(entity => entity.type === 'ambiguous') };
 }
 
 export function retokenizeWithMapping(text, mapping = {}) {
diff --git a/lib/privacy.js b/lib/privacy.js
index 56a9699..1bac2a9 100644
--- a/lib/privacy.js
+++ b/lib/privacy.js
@@ -1,7 +1,8 @@
 import { buildIdentityRegistry, redactForModel, reidentify } from './identity-redaction.js';
 
 export function anonymizeText(text, explicit = {}) {
-  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText: explicit.participantText || text }));
+  const participantText = Object.hasOwn(explicit, 'participantText') ? explicit.participantText : text;
+  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText }));
   return {
     anonymizedText: result.text,
     mapping: result.mapping,
diff --git a/scripts/generate-dna-anonymization-test.mjs b/scripts/generate-dna-anonymization-test.mjs
index 33fd8aa..5770485 100644
--- a/scripts/generate-dna-anonymization-test.mjs
+++ b/scripts/generate-dna-anonymization-test.mjs
@@ -10,4 +10,13 @@ assert.doesNotMatch(current.anonymizedPrompt, /tax prep for self-employed contra
 const legacy = anonymizePrompt('Business Category: Professional Services');
 assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Professional Services', 'the primary report path still tokenizes the legacy label');
 
+const template = '### Revenue Engine\n## Quick Read\nGoogle Drive is used for planning.\nParticipant answer: Sarah Nguyen called.';
+const participant = 'Sarah Nguyen called.';
+const participantOnly = anonymizePrompt(template, participant);
+assert.match(participantOnly.anonymizedPrompt, /Revenue Engine|Quick Read|Google Drive/, 'template headings and common tools are not scanned as participant names');
+assert.doesNotMatch(participantOnly.anonymizedPrompt, /Sarah|Nguyen/i, 'participant names are replaced before the DNA model request');
+
+const noParticipant = anonymizePrompt(template, '');
+assert.match(noParticipant.anonymizedPrompt, /Revenue Engine|Quick Read/, 'an empty participant-text value disables heuristic template scanning');
+
 console.log('generate-dna anonymization tests passed');
diff --git a/scripts/identity-redaction-test.mjs b/scripts/identity-redaction-test.mjs
index b7dad7d..934b401 100644
--- a/scripts/identity-redaction-test.mjs
+++ b/scripts/identity-redaction-test.mjs
@@ -8,10 +8,10 @@ function redact(text, identity = {}, declaredPeople = []) {
 }
 
 let result = redact('Darren Randles approves quotes and Darren in sales sends them.', { clientName: 'Darren Randles' });
-assert.match(result.text, /^\[OWNER_NAME\] approves quotes and \[OWNER_NAME\] in sales sends them\.$/);
+assert.match(result.text, /^\[OWNER_NAME\] approves quotes and \[PERSON_AMBIGUOUS_1\] in sales sends them\.$/);
 
 result = redact('Darren handles the quotes. Randles approves them. darren is an ordinary word.', { clientName: 'Darren Randles' });
-assert.match(result.text, /^\[OWNER_NAME\] handles the quotes\. \[OWNER_NAME\] approves them\. darren is an ordinary word\.$/);
+assert.match(result.text, /^\[PERSON_AMBIGUOUS_1\] handles the quotes\. \[OWNER_NAME\] approves them\. darren is an ordinary word\.$/);
 
 result = redact('Sarah Miles handles the quotes.', { clientName: 'Darren Randles' }, [{ label: 'Sarah Miles', role: 'sales manager' }]);
 assert.match(result.text, /^\[PERSON_SALES_MANAGER_1\] handles the quotes\.$/);
@@ -19,6 +19,15 @@ assert.match(result.text, /^\[PERSON_SALES_MANAGER_1\] handles the quotes\.$/);
 result = redact('Sarah Nguyen at Acme Foods orders weekly.', {});
 assert.match(result.text, /\[PERSON_DETECTED_1\] at \[ORG_1\] orders weekly\./);
 
+result = redact('Sarah Nguyen at Acme Foods orders weekly. Sarah called again. Nguyen wants a discount. SARAH NGUYEN too.', {});
+assert.doesNotMatch(result.text, /Sarah|Nguyen/i, 'every detected-person form stays out of model-bound text');
+
+result = redact('Darren the owner approves. Darren in sales sends quotes. Darren M. handles shipping.', { clientName: 'Darren Randles' }, [{ label: 'Darren M.', role: 'sales manager' }]);
+assert.match(result.text, /^\[PERSON_AMBIGUOUS_1\] the owner approves\. \[PERSON_AMBIGUOUS_1\] in sales sends quotes\. \[PERSON_SALES_MANAGER_1\] handles shipping\.$/);
+
+result = redact('DARREN RANDLES and darren randles.', { clientName: 'Darren Randles' });
+assert.match(result.text, /^\[OWNER_NAME\] and \[OWNER_NAME\]\.$/, 'multi-word known names match case-insensitively');
+
 result = redact("Darren's quotes, DARREN, Darren.", { clientName: 'Darren Randles' });
 assert.doesNotMatch(result.text, /Darren/i);
 
diff --git a/scripts/recover-dna-anonymization-test.mjs b/scripts/recover-dna-anonymization-test.mjs
index b98b20f..81c1c39 100644
--- a/scripts/recover-dna-anonymization-test.mjs
+++ b/scripts/recover-dna-anonymization-test.mjs
@@ -26,4 +26,8 @@ const recoveryResult = anonymizePrompt(recoveryPrompt);
 assert.equal(recoveryResult.mapping['[BUSINESS_DESCRIPTION]'], 'bookkeeping practice', 'the real recovery template feeds its description to the anonymizer');
 assert.doesNotMatch(recoveryResult.anonymizedPrompt, /bookkeeping practice/i, 'the real recovery template does not expose the description to model analysis');
 
+const participantRecovery = anonymizePrompt('## Customer Service\nSarah Nguyen called.', 'Sarah Nguyen called.');
+assert.match(participantRecovery.anonymizedPrompt, /Customer Service/, 'recovery templates are not scanned as participant answers');
+assert.doesNotMatch(participantRecovery.anonymizedPrompt, /Sarah|Nguyen/i, 'recovery participant names are replaced');
+
 console.log('recover-dna anonymization tests passed');
diff --git a/scripts/report-identity-redaction-contract-test.mjs b/scripts/report-identity-redaction-contract-test.mjs
index dfbdd43..00d94c0 100644
--- a/scripts/report-identity-redaction-contract-test.mjs
+++ b/scripts/report-identity-redaction-contract-test.mjs
@@ -3,6 +3,7 @@
 import assert from 'node:assert/strict';
 import { callClaude } from '../api/report-pack.js';
 import { reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';
+import { getIntakeOutputById } from '../lib/supabase-rest.js';
 
 const mapping = {
   '[OWNER_NAME]': 'Darren Randles',
@@ -16,6 +17,8 @@ assert.doesNotMatch(tokenized, /Darren Randles|Acme Foods|owner@example\.test|ac
 
 const originalFetch = globalThis.fetch;
 const originalKey = process.env.ANTHROPIC_API_KEY;
+const originalSupabaseUrl = process.env.SUPABASE_URL;
+const originalSupabaseKey = process.env.SUPABASE_SECRET_KEY;
 let captured = '';
 process.env.ANTHROPIC_API_KEY = 'synthetic-test-key';
 globalThis.fetch = async (_url, options) => {
@@ -33,4 +36,23 @@ try {
   else process.env.ANTHROPIC_API_KEY = originalKey;
 }
 
+let scopedUrl = '';
+process.env.SUPABASE_URL = 'https://example.supabase.test';
+process.env.SUPABASE_SECRET_KEY = 'synthetic-supabase-key';
+globalThis.fetch = async url => {
+  scopedUrl = String(url);
+  return { ok: true, status: 200, text: async () => '[]' };
+};
+try {
+  await getIntakeOutputById('mapping-1', { clientDraftId: 'draft-1', outputType: 'hermes_reidentification_map' });
+  assert.match(scopedUrl, /client_draft_id=eq.draft-1/, 'map lookup is scoped to its draft');
+  assert.match(scopedUrl, /output_type=eq.hermes_reidentification_map/, 'map lookup is scoped to the re-identification output type');
+} finally {
+  globalThis.fetch = originalFetch;
+  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
+  else process.env.SUPABASE_URL = originalSupabaseUrl;
+  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
+  else process.env.SUPABASE_SECRET_KEY = originalSupabaseKey;
+}
+
 console.log('report identity redaction contract tests passed');
```

## Targeted source search

```text
dc0fddc:api/generate-dna.js:104:export function anonymizePrompt(prompt, participantText = '') {
dc0fddc:api/generate-dna.js:112:    participantText
dc0fddc:api/generate-dna.js:295:    const participantPrivacySource = String(sourceMeta?.privacyScanText || '').trim();
dc0fddc:api/generate-dna.js:349:      identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
dc0fddc:api/generate-dna.js:367:      identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
dc0fddc:api/generate-dna.js:404:      reidentificationMappingOutputId: mappingSave.fileId || '',
dc0fddc:api/interview-ai.js:97:async function callClaude(prompt, { maxTokens = 600, identity = {}, participantText = '' } = {}) {
dc0fddc:api/interview-ai.js:98:  const privacy = anonymizeText(prompt, { ...identity, participantText });
dc0fddc:api/interview-ai.js:158:    const text = await callClaude(prompt, { maxTokens: 1400, identity: { ...identity, businessName, websiteUrl: normalizedWebsiteUrl }, participantText: description });
dc0fddc:api/interview-ai.js:189:    return { scenario: await callClaude(prompt, { maxTokens: 200, identity, participantText: description }) };
dc0fddc:api/interview-ai.js:260:    const raw = await callClaude(prompt, { maxTokens: 260, identity, participantText: safeQa }) || '';
dc0fddc:api/interview-ai.js:270:export async function masteryFollowup(body) {
dc0fddc:api/interview-ai.js:292:    return { followup: await callClaude(prompt, { maxTokens: 150, identity, participantText: safeAnswer }) || 'NONE' };
dc0fddc:api/interview-ai.js:309:    else if (task === 'mastery-followup') result = await masteryFollowup(req.body);
dc0fddc:api/privacy-proof-smoke-test.js:57:        identifiersReplaced: true,
dc0fddc:api/recover-dna.js:54:export function anonymizePrompt(prompt, participantText = '') {
dc0fddc:api/recover-dna.js:60:    participantText
dc0fddc:api/recover-dna.js:96:  (payload.masteryFollowups || []).forEach((answer, index) => {
dc0fddc:api/recover-dna.js:98:    const question = payload.masteryFollowupQ?.[index] || 'AI future follow-up';
dc0fddc:api/recover-dna.js:117:function privacyScanText(payload) {
dc0fddc:api/recover-dna.js:334:    privacyScanText: privacyScanText(payload),
dc0fddc:api/recover-dna.js:339:  const privacyGate = runPrivacyGate(sourceMeta.privacyScanText || prompt, { purpose: 'admin_recovery_venture_dna_generation' });
dc0fddc:api/recover-dna.js:349:  const hermesPrivacy = anonymizePrompt(gatedPrompt, sourceMeta.privacyScanText);
dc0fddc:api/recover-dna.js:355:    identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
dc0fddc:api/recover-dna.js:367:    identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
dc0fddc:api/recover-dna.js:401:    reidentificationMappingOutputId: mappingSave.fileId || '',
dc0fddc:api/report-pack.js:171:  const mappingRow = dnaMeta.reidentificationMappingOutputId
dc0fddc:api/report-pack.js:172:    ? await getIntakeOutputById(dnaMeta.reidentificationMappingOutputId, { clientDraftId, outputType: 'hermes_reidentification_map' })
dc0fddc:api/report-pack.js:185:    participantText: sourceText
dc0fddc:index.html:3083:let masteryFollowups = [];     // mastery follow-up answer per question index (only mastery uses it)
dc0fddc:index.html:3084:let masteryFollowupQ = [];     // the follow-up QUESTION shown for each mastery item (smart or generic)
dc0fddc:index.html:3283:    followupBuckets.get(key).push(masteryFollowups[index] || '');
dc0fddc:index.html:3284:    followupQuestionBuckets.get(key).push(masteryFollowupQ[index] || '');
dc0fddc:index.html:3299:  masteryFollowups = nextMasteryFollowups;
dc0fddc:index.html:3300:  masteryFollowupQ = nextMasteryFollowupQ;
dc0fddc:index.html:3398:    ...masteryFollowups,
dc0fddc:index.html:3618:    totalWordCount: countWords(answers[qIndex] || '') + countWords(masteryFollowups[qIndex] || '')
dc0fddc:index.html:3628:  else if (subStep === 'followup') masteryFollowups[currentQ] = val;
dc0fddc:index.html:3755:    masteryFollowups,
dc0fddc:index.html:3756:    masteryFollowupQ,
dc0fddc:index.html:3768:    interviewStarted: scenarioDone || !!scenarioStage || answers.some(Boolean) || masteryFollowups.some(Boolean) || Object.keys(domainProbes).length > 0
dc0fddc:index.html:4074:  masteryFollowups = Array.isArray(draft.masteryFollowups) ? draft.masteryFollowups : new Array(QUESTIONS.length).fill('');
dc0fddc:index.html:4075:  masteryFollowupQ = Array.isArray(draft.masteryFollowupQ) ? draft.masteryFollowupQ : new Array(QUESTIONS.length).fill('');
dc0fddc:index.html:4232:  masteryFollowups = new Array(QUESTIONS.length).fill('');
dc0fddc:index.html:4233:  masteryFollowupQ = new Array(QUESTIONS.length).fill('');
dc0fddc:index.html:4606:      qText = masteryFollowupQ[currentQ] || MASTERY_FOLLOWUP;
dc0fddc:index.html:4608:      savedValue = masteryFollowups[currentQ] || '';
dc0fddc:index.html:4675:    masteryFollowups[currentQ] = val;
dc0fddc:index.html:4979:  if (masteryFollowupQ[qIndex]) {
dc0fddc:index.html:4986:    masteryFollowupQ[qIndex] = MASTERY_FOLLOWUP;
dc0fddc:index.html:5019:  masteryFollowupQ[qIndex] = followup || MASTERY_FOLLOWUP;
dc0fddc:index.html:5456:    masteryBlock += `If AI handled it: ${masteryFollowups[i] || '(no answer provided)'}\n`;
dc0fddc:index.html:5655:        privacyScanText: buildPrivacyScanText(),
dc0fddc:index.html:5692:      identifiersReplaced: (data.hermesPrivacy.stats?.replacements || 0) > 0,
dc0fddc:lib/identity-redaction.js:51:export function buildIdentityRegistry({ identity = {}, declaredPeople = [], participantText = '' } = {}) {
dc0fddc:lib/identity-redaction.js:60:  return { owner, business, website, email, businessDescription, people, participantText: clean(participantText) };
dc0fddc:lib/identity-redaction.js:63:function detectEntities(participantText, registry, mapping, entities) {
dc0fddc:lib/identity-redaction.js:73:  while ((match = cuePattern.exec(participantText))) addPerson(clean(match[1] || match[4]), clean(match[2] || match[3]), clean(match[0]), 'context');
dc0fddc:lib/identity-redaction.js:75:  while ((match = possessiveCue.exec(participantText))) addPerson(clean(match[1]), clean(match[2]), clean(match[0]), 'context');
dc0fddc:lib/identity-redaction.js:94:  while ((match = orgPattern.exec(participantText))) {
dc0fddc:lib/identity-redaction.js:101:  while ((match = fullName.exec(participantText))) {
dc0fddc:lib/identity-redaction.js:107:  while ((match = named.exec(participantText))) addPerson(clean(match[1]), 'detected', clean(match[1]), 'detected');
dc0fddc:lib/identity-redaction.js:136:  const entityReplacements = detectEntities(registry.participantText, registry, mapping, entities);
dc0fddc:lib/privacy.js:4:  const participantText = Object.hasOwn(explicit, 'participantText') ? explicit.participantText : text;
dc0fddc:lib/privacy.js:5:  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText }));
```

## Captured local test results

### scripts/identity-redaction-test.mjs

```text
Exit code: 0
identity redaction tests passed
```

### scripts/adaptive-probe-contract-test.mjs

```text
Exit code: 0
adaptive probe contract tests passed
```

### scripts/generate-dna-anonymization-test.mjs

```text
Exit code: 0
generate-dna anonymization tests passed
```

### scripts/recover-dna-anonymization-test.mjs

```text
Exit code: 0
recover-dna anonymization tests passed
```

### scripts/report-identity-redaction-contract-test.mjs

```text
Exit code: 0
report identity redaction contract tests passed
```

## Full candidate source evidence

### api/generate-dna.js

```javascript
// api/generate-dna.js
// Server-side function that calls Claude to compile the DNA file.
// Keeps the Anthropic API key hidden from the browser.
// Hermes privacy layer: anonymizes obvious identifiers before sending the
// prompt to Claude, then re-identifies the final output before returning it.

import { decryptJson, encryptJson } from '../lib/crypto.js';
import { getIntakeSession, insertClaimTrace, insertIntakeEvent, insertIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';
import { assertDraftAccess } from '../lib/draft-access.js';
import { assertRateLimit, assertTrustedOrigin, safeError } from '../lib/security.js';
import { anonymizeText, privacyHeader } from '../lib/privacy.js';

async function logPrivacyProof(clientDraftId, eventType, status, details = {}) {
  try {
    if (!clientDraftId) return;
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'privacy_proof',
      question_index: null,
      domain: 'BTAI Secure Intelligence Layer',
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'privacy_proof',
        privacyProof: true,
        details: {
          rawInterviewIncluded: false,
          rawDnaIncluded: false,
          partnerRawAccess: false,
          encryptedAtRest: true,
          encryptionAlg: 'AES-256-GCM',
          ...details
        }
      }
    });
  } catch (err) {
    console.error('privacy proof log failed:', err);
  }
}

function retentionMetadata(category = 'first_intake') {
  const now = new Date();
  const review = new Date(now);
  if (category === 'draft') review.setDate(review.getDate() + 30);
  else review.setMonth(review.getMonth() + 24);
  return {
    retentionPolicyVersion: '2026-07-30-v1',
    retentionCategory: category,
    scheduledReviewDate: review.toISOString(),
    deletionRequestPathAvailable: true
  };
}

async function callClaude(messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error('Anthropic API call failed: ' + error);
  }
  return response.json();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

export function anonymizePrompt(prompt, participantText = '') {
  const redacted = anonymizeText(prompt, {
    clientName: extractField(prompt, 'Owner Name'),
    businessName: extractField(prompt, 'Business Name'),
    businessDescription: extractField(prompt, 'Business Description') || extractField(prompt, 'Business Category'),
    websiteUrl: extractField(prompt, 'Website URL'),
    // Only interview answers are eligible for heuristic person detection. The
    // prompt contains ordinary-language headings and instructions.
    participantText
  });
  return {
    anonymizedPrompt: privacyHeader(redacted.ambiguous) + redacted.anonymizedText,
    mapping: redacted.mapping,
    stats: redacted.stats,
    ambiguous: redacted.ambiguous
  };
}

function reidentifyText(text, mapping) {
  let output = text || '';
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

function applyPrivacyRedactions(text, redactionMap = []) {
  let output = String(text || '');
  const entries = [...(redactionMap || [])]
    .filter(item => item && item.original && item.token)
    .sort((a, b) => String(b.original).length - String(a.original).length);
  for (const item of entries) {
    output = output.replace(new RegExp(escapeRegExp(item.original), 'g'), item.token);
  }
  return output;
}

async function saveAnonymizationMapping(clientDraftId, mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for mapping storage' };

    const business = mapping['[BUSINESS_NAME]'] || 'Client_Business';
    const safeBusiness = business.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const content = {
      createdAt: new Date().toISOString(),
      warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
      label: `${safeBusiness}_HERMES_PRIVATE_MAPPING_${dateStr}.json`,
      stats,
      mapping
    };

    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'hermes_reidentification_map',
      encrypted_payload: encryptJson(content)
    });
    return { saved: true, fileId: row?.id || '', link: '' };
  } catch (err) {
    console.error('Hermes mapping save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult, sourceLabel = 'venture_dna_generation') {
  try {
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for privacy gate storage' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: `privacy_gate_${sourceLabel}`,
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        gateVersion: gateResult.gateVersion,
        purpose: gateResult.purpose,
        decision: gateResult.decision,
        requiresReview: gateResult.requiresReview,
        summary: gateResult.summary,
        proofFindings: gateResult.proofFindings,
        originalHash: gateResult.originalHash,
        sanitizedHash: gateResult.sanitizedHash,
        sanitizedText: gateResult.sanitizedText,
        redactionMap: gateResult.redactionMap
      })
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    console.error('Privacy Gate secure save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function saveCompletedDna(clientDraftId, dnaContent, meta = {}) {
  try {
    if (!clientDraftId) return { saved: false, reason: 'No clientDraftId for output storage' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'venture_dna_markdown',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        dnaContent,
        meta: {
          ...meta,
          retention: retentionMetadata('first_intake')
        }
      })
    });
    await updateIntakeSession(clientDraftId, {
      status: 'complete',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    console.error('Completed DNA secure save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function saveClaimTrace(clientDraftId, validation) {
  try {
    if (!clientDraftId || !validation?.claims?.length) return { saved: false, reason: 'No evidence-labelled claims found' };
    await Promise.all(validation.claims.map(claim => insertClaimTrace({
      client_draft_id: clientDraftId,
      report_section: claim.reportSection,
      claim_text: claim.claimText,
      evidence_type: claim.evidenceType,
      source_question_id: '',
      source_excerpt: '',
      confidence: null
    })));
    return { saved: true, count: validation.claims.length };
  } catch (err) {
    console.error('Claim trace save failed:', err);
    return { saved: false, reason: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, clientDraftId, draftAccessToken, sourceMeta } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'generate-dna', limit: 3, windowMs: 60_000 });
    assertDraftAccess(draftAccessToken, clientDraftId);
    const storedSession = await getIntakeSession(clientDraftId);
    const storedPayload = storedSession?.encrypted_payload ? decryptJson(storedSession.encrypted_payload) : null;
    if (!storedPayload?.privacyConsent || !storedPayload?.privacyConsentAt || !storedPayload?.privacyPolicyVersion) {
      return res.status(409).json({ error: 'Privacy consent must be saved before generating a report' });
    }
    if (String(process.env.BTAI_ENABLE_AUTOMATED_AI || '').toLowerCase() !== 'true') {
      return res.status(503).json({ error: 'Automated report generation is not enabled for this pilot' });
    }
    await logPrivacyProof(clientDraftId, 'privacy_proof_consent_recorded', sourceMeta?.privacyConsent ? 'success' : 'failed', {
      privacyProofType: 'consent',
      privacyConsentAccepted: !!sourceMeta?.privacyConsent,
      privacyConsentAt: sourceMeta?.privacyConsentAt || '',
      privacyPolicyVersion: sourceMeta?.privacyPolicyVersion || '',
      partnerAggregateDisclosureShown: !!sourceMeta?.partnerAggregateDisclosureShown,
      partnerAggregateDisclosureAccepted: !!sourceMeta?.partnerAggregateDisclosureAccepted,
      proofStatus: sourceMeta?.privacyConsent ? 'passed' : 'failed'
    });
    const crossBorderNoticePassed = !!(
      sourceMeta?.crossBorderProcessingNoticePresented &&
      sourceMeta?.serviceProviderPolicyAvailable &&
      sourceMeta?.privacyContactPresented &&
      sourceMeta?.privacyPolicyVersion
    );
    await logPrivacyProof(clientDraftId, 'privacy_proof_cross_border_notice', crossBorderNoticePassed ? 'success' : 'failed', {
      privacyProofType: 'cross_border_notice',
      crossBorderProcessingNoticePresented: !!sourceMeta?.crossBorderProcessingNoticePresented,
      serviceProviderPolicyAvailable: !!sourceMeta?.serviceProviderPolicyAvailable,
      privacyContactPresented: !!sourceMeta?.privacyContactPresented,
      privacyPolicyVersion: sourceMeta?.privacyPolicyVersion || '',
      proofStatus: crossBorderNoticePassed ? 'passed' : 'failed'
    });
    await logPrivacyProof(clientDraftId, 'privacy_proof_retention_policy_recorded', 'success', {
      privacyProofType: 'retention',
      ...retentionMetadata('first_intake'),
      proofStatus: 'passed'
    });
    const participantPrivacySource = String(sourceMeta?.privacyScanText || '').trim();
    const promptPrivacyGate = runPrivacyGate(prompt, { purpose: 'venture_dna_generation' });
    const sourcePrivacyGate = participantPrivacySource && participantPrivacySource !== prompt
      ? runPrivacyGate(participantPrivacySource, { purpose: 'venture_dna_generation_source' })
      : null;
    const privacyGate = promptPrivacyGate.requiresReview
      ? promptPrivacyGate
      : (sourcePrivacyGate?.requiresReview ? sourcePrivacyGate : promptPrivacyGate);
    const privacyGateSave = await savePrivacyGateRecord(clientDraftId, privacyGate, 'venture_dna_generation');
    await logPrivacyProof(clientDraftId, 'privacy_gate_scan_completed', privacyGateSave.saved ? 'success' : 'failed', gateProofDetails(privacyGate, {
      payloadType: participantPrivacySource ? 'participant_supplied_interview_text' : 'raw_interview_prompt',
      promptGateDecision: promptPrivacyGate.decision,
      promptGateRequiresReview: promptPrivacyGate.requiresReview,
      sourceGateDecision: sourcePrivacyGate?.decision || '',
      sourceGateRequiresReview: !!sourcePrivacyGate?.requiresReview,
      privacyGateOutputId: privacyGateSave.outputId || '',
      privacyGateSaveReason: privacyGateSave.reason || '',
      proofStatus: privacyGateSave.saved ? (privacyGate.requiresReview ? 'review_required' : 'passed') : 'failed'
    }));

    if (privacyGate.requiresReview) {
      if (clientDraftId) {
        await updateIntakeSession(clientDraftId, {
          status: 'privacy_review_required',
          updated_at: new Date().toISOString()
        });
      }
      await logPrivacyProof(clientDraftId, 'privacy_gate_quarantine_created', 'success', gateProofDetails(privacyGate, {
        payloadType: participantPrivacySource ? 'participant_supplied_interview_text' : 'raw_interview_prompt',
        aiPayloadBlocked: true,
        aiReceivesSanitizedPayloadOnly: false,
        proofStatus: 'review_required'
      }));
      return res.status(409).json({
        error: 'Privacy review required',
        message: 'The interview appears to include sensitive information. The encrypted original has been preserved, a sanitized payload was created, and AI generation has been paused for Bridge To AI review.',
        privacyGate: publicGateSummary(privacyGate),
        secureStorage: {
          saved: !!privacyGateSave.saved,
          outputId: privacyGateSave.outputId || '',
          reason: privacyGateSave.reason || ''
        }
      });
    }

    const gatedPrompt = promptPrivacyGate.sanitizedText;
    const hermesPrivacy = anonymizePrompt(gatedPrompt, participantPrivacySource);
    await logPrivacyProof(clientDraftId, 'privacy_proof_anonymization_completed', 'success', {
      privacyProofType: 'anonymization',
      payloadType: 'sanitized_interview_prompt',
      aiPayloadType: 'sanitized_anonymized_business_profile',
      privacyGateVersion: privacyGate.gateVersion,
      privacyGateDecision: privacyGate.decision,
      sanitizedAiPayloadCreated: true,
      identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
      identityRedactionStats: hermesPrivacy.stats,
      anonymizationReplacements: hermesPrivacy.stats.replacements || 0,
      proofStatus: 'passed'
    });
    const mappingSave = await saveAnonymizationMapping(clientDraftId, hermesPrivacy.mapping, hermesPrivacy.stats);
    await logPrivacyProof(clientDraftId, 'privacy_proof_mapping_storage', mappingSave.saved ? 'success' : 'info', {
      privacyProofType: 'reidentification_map',
      piiMappingStoredEncrypted: !!mappingSave.saved,
      mappingFileId: mappingSave.fileId || '',
      proofStatus: mappingSave.saved ? 'passed' : 'not_required',
      note: mappingSave.reason || ''
    });
    const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
    await logPrivacyProof(clientDraftId, 'privacy_proof_ai_analysis_requested', 'success', {
      privacyProofType: 'ai_analysis',
      payloadType: 'anonymized_prompt',
      aiPayloadType: 'anonymized_business_profile',
      identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
      identityRedactionStats: hermesPrivacy.stats,
      proofStatus: 'passed'
    });
    let fullText = '';
    let stopReason = null;
    let passes = 0;
    const MAX_PASSES = 4;

    do {
      const data = await callClaude(messages);
      const piece = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
      fullText += piece;
      stopReason = data.stop_reason;
      passes++;

      if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
        messages.push({ role: 'assistant', content: piece });
        messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
      } else {
        break;
      }
    } while (passes < MAX_PASSES);

    const truncated = (stopReason === 'max_tokens');
    if (truncated) {
      fullText += '\n\n> NOTE TO DARREN: This DNA file reached the maximum generation length. The content above is complete through where it stops; regenerate or extend manually if a later section is cut.';
    }

    const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);
    const validation = validateDnaOutput(reidentifiedText, sourceMeta || {});
    const claimTraceSave = await saveClaimTrace(clientDraftId, validation);
    const outputSave = await saveCompletedDna(clientDraftId, reidentifiedText, {
      truncated,
      sourceMeta: sourceMeta || {},
      privacyGate: publicGateSummary(privacyGate),
      anonymizationStats: hermesPrivacy.stats,
      reidentificationMappingOutputId: mappingSave.fileId || '',
      validation: {
        ...validation,
        claimTraceSaved: !!claimTraceSave.saved,
        claimTraceCount: claimTraceSave.count || 0,
        claimTraceReason: claimTraceSave.reason || ''
      }
    });
    await logPrivacyProof(clientDraftId, 'privacy_proof_secure_output_storage', outputSave.saved ? 'success' : 'failed', {
      privacyProofType: 'secure_storage',
      outputType: 'venture_dna_markdown',
      encryptedAtRest: !!outputSave.saved,
      encryptionAlg: 'AES-256-GCM',
      rawDnaIncluded: false,
      partnerRawAccess: false,
      claimTraceSaved: !!claimTraceSave.saved,
      proofStatus: outputSave.saved ? 'passed' : 'failed',
      error: outputSave.reason || ''
    });

    return res.status(200).json({
      dnaContent: reidentifiedText,
      truncated,
      secureStorage: {
        saved: !!outputSave.saved,
        outputId: outputSave.outputId || '',
        reason: outputSave.reason || '',
        validation: {
          ...validation,
          claimTraceSaved: !!claimTraceSave.saved,
          claimTraceCount: claimTraceSave.count || 0,
          claimTraceReason: claimTraceSave.reason || ''
        }
      },
      hermesPrivacy: {
        anonymized: (hermesPrivacy.stats.replacements || 0) > 0,
        stats: hermesPrivacy.stats,
        mappingSaved: !!mappingSave.saved,
        mappingSaveReason: mappingSave.reason || '',
        mappingFileId: mappingSave.fileId || ''
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    return safeError(res, err, 'Report generation unavailable');
  }
}
```

### api/interview-ai.js

```javascript
import { anonymizeText, privacyHeader, reidentifyText } from '../lib/privacy.js';
import { runPrivacyGate } from '../lib/privacy-gate.js';
import { assertRateLimit, assertTrustedOrigin, safeError } from '../lib/security.js';

function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9000);
}

async function fetchWebsiteText(websiteUrl) {
  const url = normalizeUrl(websiteUrl);
  if (!url) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BridgeToAI-Intake/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!resp.ok) return '';
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return '';
    return extractVisibleText(await resp.text());
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseClaudeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Claude returned an empty context response');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw firstErr;
  }
}

function fallbackContext({ businessCategory, websiteUrl }) {
  return {
    summary: '',
    offers: [],
    likelyCustomers: [],
    positioning: '',
    tone: '',
    likelyWorkflows: [],
    likelyAiOpportunities: [],
    questionGuidance: [],
    interviewLanguageRules: [
      'Use generic phrasing such as "businesses like yours", "your industry often", and "this type of operation".',
      'Do not say or imply that the website was researched during the interview.'
    ],
    source: websiteUrl ? 'business_type_with_website_unavailable' : 'business_type_only',
    businessCategory: businessCategory || ''
  };
}

function businessDescription({ businessCategory, businessNiche } = {}) {
  return String(businessNiche || businessCategory || '').trim().slice(0, 160);
}

async function callClaude(prompt, { maxTokens = 600, identity = {}, participantText = '' } = {}) {
  const privacy = anonymizeText(prompt, { ...identity, participantText });
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: privacyHeader(privacy.ambiguous) + privacy.anonymizedText }]
    })
  });
  if (!response.ok) throw new Error('Claude call failed: ' + await response.text());
  const data = await response.json();
  const raw = data.content?.[0]?.text ? data.content[0].text.trim() : '';
  return reidentifyText(raw, privacy.mapping);
}

async function researchBusiness(body) {
  const { businessName, businessCategory, businessNiche, shareComfort, websiteUrl, companySize, departments, identity = {} } = body || {};
  const description = businessDescription({ businessCategory, businessNiche });
  if (!description && !websiteUrl) return { context: fallbackContext({ businessCategory, websiteUrl }) };

  try {
    const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
    const websiteText = await fetchWebsiteText(normalizedWebsiteUrl);
    const prompt = `Build an INTERNAL business context profile for an AI implementation discovery interview.

Client-provided information:
- Business name: ${businessName || '(not provided)'}
- Business description: ${description || '(not provided)'}
- Detail-sharing comfort: ${shareComfort || '(not provided)'}
- Website URL: ${normalizedWebsiteUrl || '(not provided)'}
- Company size: ${companySize || '(not provided)'}
- Departments/functions: ${departments && departments.length ? departments.join(', ') : '(not provided)'}

Website text, if available:
${websiteText || '(no website text available)'}

Return ONLY raw valid JSON with this exact shape. Do not wrap it in markdown, code fences, or explanatory text:
{
  "summary": "1-2 sentence private internal summary",
  "offers": ["visible or likely offer"],
  "likelyCustomers": ["customer segment"],
  "positioning": "how this business appears to position itself",
  "tone": "plain-language voice/tone notes",
  "likelyWorkflows": ["workflow likely to matter"],
  "likelyAiOpportunities": ["specific AI opportunity likely relevant"],
  "questionGuidance": ["guidance for asking sharper interview follow-ups"],
  "interviewLanguageRules": ["client-facing language rule"]
}

Rules:
- This profile is for Darren's private use only.
- Do NOT overstate certainty. Use "likely" when inferred.
- Interview questions must sound industry-informed, not researched.
- Do NOT write "your website says", "I noticed", "we saw", or anything that reveals background research to the client.`;

    const text = await callClaude(prompt, { maxTokens: 1400, identity: { ...identity, businessName, websiteUrl: normalizedWebsiteUrl }, participantText: description });
    const context = parseClaudeJson(text);
    return {
      context: {
        ...fallbackContext({ businessCategory, websiteUrl: normalizedWebsiteUrl }),
        ...context,
        source: websiteText ? 'business_type_and_website' : 'business_type_only',
        websiteUrl: normalizedWebsiteUrl
      }
    };
  } catch (err) {
    console.error('research-business error:', err);
    return { context: fallbackContext({ businessCategory, websiteUrl }), warning: 'context_unavailable' };
  }
}

async function scenario(body) {
  const { businessCategory, businessNiche, businessContext, identity = {} } = body || {};
  const description = businessDescription({ businessCategory, businessNiche }) || 'small business';
  const contextBlock = businessContext ? `\n\nInternal context for tailoring only:\n${JSON.stringify(businessContext).slice(0, 3000)}\n\nUse this to choose a more relevant situation, but do not reveal or imply background research.` : '';
  const prompt = `Write ONE short, realistic customer-interaction scenario for a "${description}".

The scenario should be a moment where the customer is mildly unhappy or has a real need - something where HOW the business owner responds reveals their standards, tone, and values. It must be specific enough to feel real for this type of business, but open enough that any owner could respond in their own way.

Rules:
- 1-2 sentences, written in plain language, addressed to the owner ("A customer...").
- Make it specific to a ${description} using believable industry patterns.
- If internal context is available, fit the scenario to likely workflows without saying "your website", "I noticed", "we saw", or anything that reveals background research.
- Do NOT suggest how to respond. Just set up the situation.
- Output ONLY the scenario text. No preamble, no quotes, no label.${contextBlock}`;
  try {
    return { scenario: await callClaude(prompt, { maxTokens: 200, identity, participantText: description }) };
  } catch (err) {
    console.error('Scenario error:', err);
    return { scenario: '' };
  }
}

function soloOrNoStaff(companySize, ownerWorkStatus, departments) {
  return /(^|\D)(0|1)(\D|$)/.test(String(companySize || '')) || /semi[- ]?retired|mostly just me|solo|self[- ]?employed|no employees/i.test(`${ownerWorkStatus || ''} ${Array.isArray(departments) ? departments.join(' ') : ''}`);
}

export async function probe(body) {
  const { domain, qa, businessCategory, businessNiche, shareComfort, companySize, ownerWorkStatus, departments = [], businessContext, sourceQuestion, sourceQuestionType, answerQualityBucket, priorityWeight, weakAnswerReason, identity = {} } = body || {};
  if (!qa) return { status: 400, body: { error: 'Missing qa' } };
  const probePrivacy = runPrivacyGate(qa, { purpose: 'interview_adaptive_probe' });
  // A probe is optional. If an answer contains information that needs review,
  // do not send it to the model; the interview simply continues normally.
  if (probePrivacy.requiresReview) return { followup: 'NONE' };
  const safeQa = probePrivacy.sanitizedText || qa;
  const description = businessDescription({ businessCategory, businessNiche }) || 'small business';
  const contextBlock = businessContext ? `\n\nInternal context for sharper judgment only:\n${JSON.stringify(businessContext).slice(0, 3000)}\n\nUse this to understand likely workflows and industry patterns. Do not reveal background research.` : '';
  const orgContext = `Business description: ${description}. Detail-sharing comfort: ${shareComfort || 'directional only'}. Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
  const prompt = `You are conducting a business discovery interview for a ${description}.

Organization context:
${orgContext}
${soloOrNoStaff(companySize, ownerWorkStatus, departments) ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask about staff, employees, departments, or team handoffs as if they currently exist.' : ''}

The client just gave a weak or vague answer to this ${sourceQuestionType ? `"${sourceQuestionType}"` : 'discovery'} question${sourceQuestion ? `: "${sourceQuestion}"` : ` in the "${domain}" section`}.

Answer quality signal: ${answerQualityBucket || 'unknown'}.
Question importance weight: ${priorityWeight || 'not supplied'} out of 5.
Reason the redirect may be needed: ${weakAnswerReason || 'not supplied'}.

${safeQa}
${contextBlock}

Your job: ask ONE short redirect question only if it would meaningfully turn a thin answer into usable business context. Default to no follow-up if the answer is already usable.

Rules:
- If the answers are clear enough to analyze, return ask_followup false.
- Do not ask broad recap questions such as "walk me through your process" or "what does your current process look like".
- Only ask for one missing high-value fact: a concrete example, frequency/range, blocker, owner/readiness, information location, human-review boundary, or desired practical output.
- Make the redirect specific to the business niche and question they just answered. Do not ask a generic "tell me more" question.
- Keep the question under 220 characters.
- Ask for directional ranges, severity, priority, frequency, blocker, owner/readiness, risk, low-risk pilot, clarify, or voice/tone only.
- Never ask for exact revenue, exact profit, exact margin, payroll, bank/tax/legal records, customer names, supplier names, employee personal details, recipes, formulas, contracts, invoices, purchase orders, passwords, API keys, health information, or legal personal information.
- Do not recommend tools, vendors, or Bridge To AI services during the interview.

Return ONLY raw valid JSON. Do not wrap it in markdown:
{
  "ask_followup": true,
  "question_type": "clarify",
  "domain": "${domain}",
  "question": "One safe, short follow-up question or empty string",
  "why_needed": "Short internal reason",
  "sensitivity_level": "low",
  "uses_approved_category": true
}

If no follow-up is needed, return:
{
  "ask_followup": false,
  "question_type": "clarify",
  "domain": "${domain}",
  "question": "",
  "why_needed": "Answers are sufficient",
  "sensitivity_level": "low",
  "uses_approved_category": true
}`;
  try {
    const raw = await callClaude(prompt, { maxTokens: 260, identity, participantText: safeQa }) || '';
    const parsed = parseClaudeJson(raw);
    if (parsed && typeof parsed === 'object') return { followup: parsed };
    return { followup: 'NONE' };
  } catch (err) {
    console.error('Probe error:', err);
    return { followup: 'NONE' };
  }
}

export async function masteryFollowup(body) {
  const { area, answer, businessCategory, businessNiche, companySize, ownerWorkStatus, departments = [], businessContext, identity = {} } = body || {};
  const description = businessDescription({ businessCategory, businessNiche }) || 'small business';
  if (!answer) return { status: 400, body: { error: 'Missing answer' } };
  const gate = runPrivacyGate(answer, { purpose: 'interview_mastery_followup' });
  if (gate.requiresReview) return { followup: 'NONE' };
  const safeAnswer = gate.sanitizedText || answer;
  const contextBlock = businessContext ? `\n\nInternal context for tailoring only:\n${JSON.stringify(businessContext).slice(0, 2500)}\n\nDo not reveal or imply background research happened.` : '';
  const orgContext = `Company size: ${companySize || 'not specified'} people. Owner status/capacity: ${ownerWorkStatus || 'not specified'}. Departments/functions selected: ${Array.isArray(departments) && departments.length ? departments.join(', ') : 'not specified'}.`;
  const prompt = `You are conducting a warm, professional business discovery interview for a ${description} owner.

Organization context:
${orgContext}
${soloOrNoStaff(companySize, ownerWorkStatus, departments) ? 'Important: This appears to be a solo, no-staff, or semi-retired operator. Do not ask staff/team questions unless they explicitly mentioned employees.' : ''}

You just asked them where they are with "${area}". They answered:

"${safeAnswer}"
${contextBlock}

Write ONE short follow-up question that picks up a specific thing they actually said and asks what AI handling it would change. If too vague, respond exactly: NONE.`;
  try {
    return { followup: await callClaude(prompt, { maxTokens: 150, identity, participantText: safeAnswer }) || 'NONE' };
  } catch (err) {
    console.error('Mastery follow-up error:', err);
    return { followup: 'NONE' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const task = String(req.body?.task || '').trim();
  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'interview-ai', limit: 20, windowMs: 60_000 });
    let result;
    if (task === 'research-business') result = await researchBusiness(req.body);
    else if (task === 'scenario') result = await scenario(req.body);
    else if (task === 'probe') result = await probe(req.body);
    else if (task === 'mastery-followup') result = await masteryFollowup(req.body);
    else return res.status(400).json({ error: 'Unknown interview AI task' });

    if (result?.status) return res.status(result.status).json(result.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('interview-ai error:', err);
    return safeError(res, err, 'Interview assistance is temporarily unavailable');
  }
}
```

### api/recover-dna.js

```javascript
import { decryptJson, encryptJson } from '../lib/crypto.js';
import { insertClaimTrace, insertIntakeEvent, insertIntakeOutput, getIntakeSession, getLatestIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';
import { anonymizeText, privacyHeader } from '../lib/privacy.js';

function retentionMetadata(category = 'first_intake') {
  const now = new Date();
  const review = new Date(now);
  if (category === 'draft') review.setDate(review.getDate() + 30);
  else review.setMonth(review.getMonth() + 24);
  return {
    retentionPolicyVersion: '2026-07-30-v1',
    retentionCategory: category,
    scheduledReviewDate: review.toISOString(),
    deletionRequestPathAvailable: true
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPrivacyRedactions(text, redactionMap = []) {
  let output = String(text || '');
  const entries = [...(redactionMap || [])]
    .filter(item => item && item.original && item.token)
    .sort((a, b) => String(b.original).length - String(a.original).length);
  for (const item of entries) {
    output = output.replace(new RegExp(escapeRegExp(item.original), 'g'), item.token);
  }
  return output;
}

function extractField(prompt, label) {
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, 'im');
  const match = prompt.match(re);
  return match ? match[1].trim() : '';
}

function addMapping(map, placeholder, value) {
  const cleaned = String(value || '').trim();
  if (!cleaned || cleaned.length < 2) return;
  if (cleaned === '(not provided)' || cleaned === '(not specified)') return;
  if (!map[placeholder]) map[placeholder] = cleaned;
}

function replaceAllLiteral(text, value, placeholder) {
  if (!value || value.length < 2) return text;
  return text.replace(new RegExp(escapeRegExp(value), 'g'), placeholder);
}

export function anonymizePrompt(prompt, participantText = '') {
  const redacted = anonymizeText(prompt, {
    clientName: extractField(prompt, 'Owner Name'),
    businessName: extractField(prompt, 'Business Name'),
    businessDescription: extractField(prompt, 'Business Description') || extractField(prompt, 'Business Category'),
    websiteUrl: extractField(prompt, 'Website URL'),
    participantText
  });
  return {
    anonymizedPrompt: privacyHeader(redacted.ambiguous) + redacted.anonymizedText,
    mapping: redacted.mapping,
    stats: redacted.stats,
    ambiguous: redacted.ambiguous
  };
}

function reidentifyText(text, mapping) {
  let output = text || '';
  Object.entries(mapping || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([placeholder, value]) => {
      output = output.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
    });
  return output;
}

function safeText(value, fallback = '(not provided)') {
  const text = String(value || '').trim();
  return text || fallback;
}

function wordCount(text) {
  const cleaned = String(text || '').trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function answeredItems(payload) {
  const items = [];
  (payload.answers || []).forEach((answer, index) => {
    if (!String(answer || '').trim()) return;
    items.push(`Answer ${index + 1}: ${answer}`);
  });
  (payload.masteryFollowups || []).forEach((answer, index) => {
    if (!String(answer || '').trim()) return;
    const question = payload.masteryFollowupQ?.[index] || 'AI future follow-up';
    items.push(`Follow-up after answer ${index + 1}: ${question}\n${answer}`);
  });
  Object.values(payload.domainProbes || {}).forEach((probe, index) => {
    if (!String(probe?.answer || '').trim()) return;
    items.push(`Adaptive clarification ${index + 1}${probe.domain ? ` (${probe.domain})` : ''}: ${probe.question || 'Clarifying question'}\n${probe.answer}`);
  });
  (payload.snapshotAnswersArchive || []).forEach((item, index) => {
    if (!String(item?.answer || '').trim()) return;
    items.push(`Snapshot archive ${index + 1}${item.domain ? ` (${item.domain})` : ''}: ${item.question || 'Archived question'}\n${item.answer}`);
  });
  if (payload.scenarioGood || payload.scenarioBad) {
    items.push(`Voice and standards scenario: ${payload.scenarioText || '(scenario text not saved)'}`);
    if (payload.scenarioGood) items.push(`Best/proud reply: ${payload.scenarioGood}`);
    if (payload.scenarioBad) items.push(`Off-brand reply: ${payload.scenarioBad}`);
  }
  return items;
}

function privacyScanText(payload) {
  return answeredItems(payload).join('\n\n').trim();
}

export function buildRecoveryPrompt(payload, clientDraftId) {
  const items = answeredItems(payload);
  const context = payload.businessContext ? JSON.stringify(payload.businessContext, null, 2) : 'Not available.';
  const interviewMode = String(payload.intakeVariant || payload.questionSet || '').includes('snapshot')
    ? 'a shorter Snapshot First interview designed to generate a practical free AI Opportunity Snapshot and determine whether deeper diagnosis is warranted'
    : 'a Bridge To AI intake interview';

  return `You are a business analyst for Bridge To AI, an AI implementation consulting firm run by Darren Randles in Alberta, Canada.

This is an ADMIN RECOVERY generation. The client already completed the intake, but the first Venture DNA output was paused by the Privacy Gate before the report files were created. Use only the recovered saved interview payload below. If the saved payload lacks a question label, treat the numbered answer as client-stated evidence but do not invent missing facts.

Create a structured Venture DNA source file that downstream Bridge To AI reports can use. Write clearly, practically, and with evidence discipline. Label major claims as Client-stated, Derived, Inferred, or Needs confirmation.

CLIENT INFORMATION:
Owner Name: ${safeText(payload.clientName)}
Owner Email: ${safeText(payload.clientEmail)}
Business Name: ${safeText(payload.businessName)}
Business Description: ${safeText(payload.businessNiche || payload.businessCategory)}
Website URL: ${safeText(payload.websiteUrl)}
Company Size: ${safeText(payload.companySize)}
Owner Work Status: ${safeText(payload.ownerWorkStatus)}
Departments / Functions: ${Array.isArray(payload.departments) ? payload.departments.join(', ') : safeText(payload.departments)}
Share Comfort: ${safeText(payload.shareComfort)}
Partner: ${safeText(payload.campaignPartner || payload.partner || 'BTAI')}
Campaign: ${safeText(payload.campaignId || payload.campaign || 'general_intake')}
Question Set: ${safeText(payload.questionSet || payload.intakeVariant)}
Record ID: ${clientDraftId}

INTERVIEW MODE:
The client completed ${interviewMode}.

PRIVATE BUSINESS CONTEXT PROFILE:
${context}

RECOVERED INTERVIEW ANSWERS:
${items.length ? items.map((item, index) => `\n### Recovered Evidence ${index + 1}\n${item}`).join('\n') : 'No answer text was recovered from the saved payload.'}

OUTPUT STRUCTURE:
# ${safeText(payload.businessName, 'Client Business')} - VENTURE DNA

Include these sections:
1. Business snapshot
2. What the client appears to sell and to whom
3. Current workflow drag and repeated work
4. Information readiness and cleanup needs
5. AI fit scorecard signals
6. First useful AI opportunity
7. What should stay human-reviewed
8. Safe first prompt or next move
9. Potential deeper-report questions
10. Consultant notes for Darren
11. Evidence map tying recommendations back to recovered answers

Do not claim confidential details were provided unless they appear in the recovered interview. Do not expose sensitive raw details unnecessarily. If a privacy-sensitive category appears only as a boundary, treat it as a human-review boundary rather than an operating detail.`;
}

async function logPrivacyProof(clientDraftId, eventType, status, details = {}) {
  try {
    if (!clientDraftId) return;
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'admin_recovery',
      question_index: null,
      domain: 'BTAI Secure Intelligence Layer',
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'admin_recovery',
        privacyProof: true,
        details: {
          rawInterviewIncluded: false,
          rawDnaIncluded: false,
          partnerRawAccess: false,
          encryptedAtRest: true,
          encryptionAlg: 'AES-256-GCM',
          ...details
        }
      }
    });
  } catch (err) {
    console.error('recovery privacy proof log failed:', err);
  }
}

async function callClaude(messages) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages
    })
  });
  if (!response.ok) throw new Error('Anthropic API call failed: ' + await response.text());
  return response.json();
}

async function saveAnonymizationMapping(clientDraftId, mapping, stats) {
  try {
    const hasMapping = mapping && Object.keys(mapping).length > 0;
    if (!hasMapping) return { saved: false, reason: 'No mapping entries' };
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'hermes_reidentification_map',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        warning: 'PRIVATE RE-IDENTIFICATION MAP. Do not send this file to third-party AI models.',
        stats,
        mapping
      })
    });
    return { saved: true, fileId: row?.id || '' };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult) {
  try {
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: 'privacy_gate_admin_recovery_venture_dna_generation',
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        gateVersion: gateResult.gateVersion,
        purpose: gateResult.purpose,
        decision: gateResult.decision,
        requiresReview: gateResult.requiresReview,
        adminRecoveryContinuation: true,
        summary: gateResult.summary,
        proofFindings: gateResult.proofFindings,
        originalHash: gateResult.originalHash,
        sanitizedHash: gateResult.sanitizedHash,
        sanitizedText: gateResult.sanitizedText,
        redactionMap: gateResult.redactionMap
      })
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function saveCompletedDna(clientDraftId, dnaContent, meta = {}) {
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'venture_dna_markdown',
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      dnaContent,
      meta: {
        ...meta,
        retention: retentionMetadata('first_intake')
      }
    })
  });
  await updateIntakeSession(clientDraftId, {
    status: 'complete',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return { saved: true, outputId: row?.id || '' };
}

async function saveClaimTrace(clientDraftId, validation) {
  try {
    if (!clientDraftId || !validation?.claims?.length) return { saved: false, reason: 'No evidence-labelled claims found' };
    await Promise.all(validation.claims.map(claim => insertClaimTrace({
      client_draft_id: clientDraftId,
      report_section: claim.reportSection,
      claim_text: claim.claimText,
      evidence_type: claim.evidenceType,
      source_question_id: '',
      source_excerpt: '',
      confidence: null
    })));
    return { saved: true, count: validation.claims.length };
  } catch (err) {
    return { saved: false, reason: err.message };
  }
}

async function generateRecoveredDna(clientDraftId, payload) {
  const prompt = buildRecoveryPrompt(payload, clientDraftId);
  const sourceMeta = {
    partner: payload.campaignPartner || payload.partner || 'BTAI',
    campaign: payload.campaignId || payload.campaign || 'general_intake',
    partnerDisplayName: payload.partnerDisplayName || '',
    intakeVariant: payload.intakeVariant || '',
    questionSet: payload.questionSet || '',
    businessCategory: payload.businessCategory || '',
    businessNiche: payload.businessNiche || '',
    companySize: payload.companySize || '',
    ownerWorkStatus: payload.ownerWorkStatus || '',
    privacyConsent: !!payload.privacyConsent,
    privacyConsentAt: payload.privacyConsentAt || '',
    privacyPolicyVersion: payload.privacyPolicyVersion || '',
    partnerAggregateDisclosureShown: true,
    partnerAggregateDisclosureAccepted: !!payload.privacyConsent,
    crossBorderProcessingNoticePresented: true,
    serviceProviderPolicyAvailable: true,
    privacyContactPresented: true,
    privacyScanText: privacyScanText(payload),
    adminRecovery: true,
    recoveredFromEncryptedSession: true
  };

  const privacyGate = runPrivacyGate(sourceMeta.privacyScanText || prompt, { purpose: 'admin_recovery_venture_dna_generation' });
  const privacyGateSave = await savePrivacyGateRecord(clientDraftId, privacyGate);
  await logPrivacyProof(clientDraftId, 'admin_recovery_privacy_gate_scan_completed', 'success', gateProofDetails(privacyGate, {
    payloadType: 'recovered_encrypted_session_payload',
    privacyGateOutputId: privacyGateSave.outputId || '',
    adminRecoveryContinuation: true,
    proofStatus: privacyGate.requiresReview ? 'admin_review_continued_with_sanitized_payload' : 'passed'
  }));

  const gatedPrompt = applyPrivacyRedactions(prompt, privacyGate.redactionMap);
  const hermesPrivacy = anonymizePrompt(gatedPrompt, sourceMeta.privacyScanText);
  const mappingSave = await saveAnonymizationMapping(clientDraftId, hermesPrivacy.mapping, hermesPrivacy.stats);
  await logPrivacyProof(clientDraftId, 'admin_recovery_anonymization_completed', 'success', {
    privacyProofType: 'anonymization',
    payloadType: 'sanitized_recovered_interview_prompt',
    aiPayloadType: 'sanitized_anonymized_business_profile',
    identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
    identityRedactionStats: hermesPrivacy.stats,
    anonymizationReplacements: hermesPrivacy.stats.replacements || 0,
    mappingFileId: mappingSave.fileId || '',
    proofStatus: 'passed'
  });

  const messages = [{ role: 'user', content: hermesPrivacy.anonymizedPrompt }];
  await logPrivacyProof(clientDraftId, 'admin_recovery_ai_analysis_requested', 'success', {
    privacyProofType: 'ai_analysis',
    payloadType: 'anonymized_recovered_prompt',
    aiPayloadType: 'anonymized_business_profile',
    identifiersReplaced: (hermesPrivacy.stats.replacements || 0) > 0,
    identityRedactionStats: hermesPrivacy.stats,
    proofStatus: 'passed'
  });

  let fullText = '';
  let stopReason = null;
  let passes = 0;
  const MAX_PASSES = 4;
  do {
    const data = await callClaude(messages);
    const piece = data.content?.[0]?.text || '';
    fullText += piece;
    stopReason = data.stop_reason;
    passes++;
    if (stopReason === 'max_tokens' && passes < MAX_PASSES) {
      messages.push({ role: 'assistant', content: piece });
      messages.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already written. Pick up mid-sentence if needed.' });
    } else {
      break;
    }
  } while (passes < MAX_PASSES);

  const truncated = stopReason === 'max_tokens';
  if (truncated) fullText += '\n\n> NOTE TO DARREN: This recovered DNA file reached the maximum generation length. Regenerate or extend manually if a later section is cut.';

  const reidentifiedText = reidentifyText(fullText, hermesPrivacy.mapping);
  const validation = validateDnaOutput(reidentifiedText, sourceMeta);
  const claimTraceSave = await saveClaimTrace(clientDraftId, validation);
  const outputSave = await saveCompletedDna(clientDraftId, reidentifiedText, {
    truncated,
    sourceMeta,
    privacyGate: publicGateSummary(privacyGate),
    anonymizationStats: hermesPrivacy.stats,
    reidentificationMappingOutputId: mappingSave.fileId || '',
    adminRecovery: true,
    validation: {
      ...validation,
      claimTraceSaved: !!claimTraceSave.saved,
      claimTraceCount: claimTraceSave.count || 0,
      claimTraceReason: claimTraceSave.reason || ''
    }
  });
  await logPrivacyProof(clientDraftId, 'admin_recovery_secure_output_storage', 'success', {
    privacyProofType: 'secure_storage',
    outputType: 'venture_dna_markdown',
    outputId: outputSave.outputId || '',
    encryptedAtRest: true,
    proofStatus: 'passed'
  });
  return { dnaContent: reidentifiedText, truncated, secureStorage: outputSave, validation };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: 'recover-dna', limit: 6, windowMs: 60_000 });
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });

    const clientDraftId = String(req.body?.clientDraftId || '').trim();
    if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

    const existing = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
    if (existing && !req.body?.forceRegenerate) {
      return res.status(200).json({
        success: true,
        reusedExisting: true,
        clientDraftId,
        outputId: existing.id,
        createdAt: existing.created_at
      });
    }

    const session = await getIntakeSession(clientDraftId);
    if (!session?.encrypted_payload) return res.status(404).json({ error: 'No encrypted intake session found for that Record ID' });
    const payload = decryptJson(session.encrypted_payload);
    const answerCount = answeredItems(payload).filter(item => wordCount(item) > 0).length;
    if (answerCount < 3) return res.status(409).json({ error: 'Saved intake does not contain enough recovered answers to generate Venture DNA' });

    await logPrivacyProof(clientDraftId, 'admin_recovery_started', 'success', {
      privacyProofType: 'admin_recovery',
      recoveredAnswerCount: answerCount,
      priorSessionStatus: session.status || '',
      forceRegenerate: !!req.body?.forceRegenerate,
      proofStatus: 'started'
    });

    const result = await generateRecoveredDna(clientDraftId, payload);
    return res.status(200).json({
      success: true,
      clientDraftId,
      recoveredAnswerCount: answerCount,
      outputId: result.secureStorage.outputId || '',
      truncated: result.truncated,
      validation: result.validation,
      message: 'Recovered Venture DNA created from the encrypted saved intake. You can now generate the free snapshot and full report pack.'
    });
  } catch (err) {
    console.error('recover-dna error:', err);
    return safeError(res, err, 'Recovery request failed');
  }
}
```

### api/report-pack.js

```javascript
import { decryptJson, encryptJson } from '../lib/crypto.js';
import { createDocxBuffer, createZipBuffer } from '../lib/docx.js';
import { createReportHtml } from '../lib/report-html.js';
import { getIntakeEvents, getIntakeSession, getIntakeOutputById, getLatestIntakeOutput, insertIntakeEvent, insertIntakeOutput, updateIntakeSession } from '../lib/supabase-rest.js';
import { gateProofDetails, publicGateSummary, runPrivacyGate } from '../lib/privacy-gate.js';
import { validateDnaOutput } from '../lib/validate-output.js';
import { assertRateLimit, assertTrustedOrigin, authorizedAdminRequest, safeError } from '../lib/security.js';
import { assertDraftAccess } from '../lib/draft-access.js';
import { buildIdentityRegistry, redactForModel, reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';

const APP_VERSION = 'v1.72.32';

const REPORTS = {
  free: {
    title: 'Free AI Opportunity Snapshot',
    outputType: 'report_free_snapshot_markdown',
    docxOutputType: 'report_free_snapshot_docx',
    htmlOutputType: 'report_free_snapshot_html',
    filename: 'Level1_report',
    maxTokens: 2100
  },
  detailed: {
    title: 'Detailed AI Readiness & Opportunity Report',
    outputType: 'report_detailed_growth_markdown',
    docxOutputType: 'report_detailed_growth_docx',
    htmlOutputType: 'report_detailed_growth_html',
    filename: 'Level2_Report',
    maxTokens: 6200
  },
  roadmap: {
    title: 'Preliminary AI Action Plan',
    outputType: 'report_full_roadmap_markdown',
    docxOutputType: 'report_full_roadmap_docx',
    htmlOutputType: 'report_full_roadmap_html',
    filename: 'Level3_Report',
    maxTokens: 7600
  },
  btai: {
    title: 'BTAI Advisor Brief',
    outputType: 'report_btai_advisor_brief_markdown',
    docxOutputType: 'report_btai_advisor_brief_docx',
    htmlOutputType: 'report_btai_advisor_brief_html',
    filename: 'Internal_brief',
    maxTokens: 5200
  }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeName(value) {
  return String(value || 'Client_Business')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'Client_Business';
}

function businessNameFromDna(dna) {
  const h = String(dna || '').match(/^#\s+(.+?)\s+(?:[-]\s*)?VENTURE DNA/im);
  if (h?.[1]) return safeName(h[1]);
  const b = String(dna || '').match(/Business name:\s*(.+)/i);
  if (b?.[1]) return safeName(b[1]);
  return 'Client_Business';
}

export async function callClaude(prompt, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error('Report generation failed: ' + await response.text());
  const data = await response.json();
  return (data.content || [])
    .filter(block => block?.type === 'text' && block.text)
    .map(block => block.text)
    .join('\n\n')
    .trim();
}

async function getDna(clientDraftId) {
  const output = await getLatestIntakeOutput(clientDraftId, 'venture_dna_markdown');
  if (!output) {
    const privacyGate = await getLatestIntakeOutput(clientDraftId, 'privacy_gate_venture_dna_generation');
    if (privacyGate) {
      const payload = decryptJson(privacyGate.encrypted_payload);
      if (payload?.requiresReview) {
        throw new PrivacyGateReviewError(
          'Privacy Gate review required before Venture DNA generation can continue. Approve the privacy gate, then regenerate the Venture DNA before creating reports.',
          payload,
          { saved: true, outputId: privacyGate.id || '', reason: 'privacy_gate_venture_dna_generation' }
        );
      }
    }
    throw new Error('No Venture DNA output found for that Record ID');
  }
  const decrypted = decryptJson(output.encrypted_payload);
  if (!decrypted.dnaContent) throw new Error('Venture DNA output is empty');
  return {
    dnaContent: decrypted.dnaContent,
    meta: decrypted.meta || {},
    outputId: output.id,
    createdAt: output.created_at
  };
}

async function getSessionPayload(clientDraftId) {
  const session = await getIntakeSession(clientDraftId);
  if (!session?.encrypted_payload) throw new Error('No intake session found for that Record ID');
  return decryptJson(session.encrypted_payload);
}

async function logReportEvent(clientDraftId, eventType, status, details = {}) {
  try {
    await insertIntakeEvent({
      client_draft_id: clientDraftId,
      event_type: eventType,
      status,
      stage: 'admin_report_pack',
      question_index: null,
      domain: String(details.campaign || details.reportTier || 'report_pack').slice(0, 160),
      answer_word_count: null,
      metadata: {
        ts: new Date().toISOString(),
        app: 'intake.bridgetoai.ca',
        eventType,
        status,
        stage: 'admin_report_pack',
        privacyProof: !!details.privacyProof,
        details
      }
    });
  } catch (err) {
    console.error('report-pack KPI log failed:', err);
  }
}

function privacyProofDefaults(extra = {}) {
  return {
    privacyProof: true,
    rawInterviewIncluded: false,
    rawDnaIncluded: false,
    partnerRawAccess: false,
    partnerAggregateOnly: true,
    encryptedAtRest: true,
    encryptionAlg: 'AES-256-GCM',
    proofStatus: 'passed',
    ...extra
  };
}

async function redactReportSource(clientDraftId, sourceText, dnaMeta = {}) {
  const mappingRow = dnaMeta.reidentificationMappingOutputId
    ? await getIntakeOutputById(dnaMeta.reidentificationMappingOutputId, { clientDraftId, outputType: 'hermes_reidentification_map' })
    : await getLatestIntakeOutput(clientDraftId, 'hermes_reidentification_map');
  if (mappingRow?.encrypted_payload) {
    const payload = decryptJson(mappingRow.encrypted_payload);
    const mapping = payload?.mapping || {};
    if (Object.keys(mapping).length) {
      return { text: retokenizeWithMapping(sourceText, mapping), mapping, stats: payload.stats || {}, source: 'stored_mapping' };
    }
  }
  const session = await getSessionPayload(clientDraftId);
  const redacted = redactForModel(sourceText, buildIdentityRegistry({
    identity: session,
    declaredPeople: session.declaredPeople,
    participantText: sourceText
  }));
  return { text: redacted.text, mapping: redacted.mapping, stats: redacted.stats, source: 'session_fallback' };
}

class PrivacyGateReviewError extends Error {
  constructor(message, gateResult, saveResult = {}) {
    super(message);
    this.name = 'PrivacyGateReviewError';
    this.privacyGate = publicGateSummary(gateResult);
    this.secureStorage = {
      saved: !!saveResult.saved,
      outputId: saveResult.outputId || '',
      reason: saveResult.reason || ''
    };
  }
}

async function savePrivacyGateRecord(clientDraftId, gateResult, sourceLabel) {
  try {
    const row = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: `privacy_gate_${sourceLabel}`,
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        gateVersion: gateResult.gateVersion,
        purpose: gateResult.purpose,
        decision: gateResult.decision,
        requiresReview: gateResult.requiresReview,
        summary: gateResult.summary,
        proofFindings: gateResult.proofFindings,
        originalHash: gateResult.originalHash,
        sanitizedHash: gateResult.sanitizedHash,
        sanitizedText: gateResult.sanitizedText,
        redactionMap: gateResult.redactionMap
      })
    });
    return { saved: true, outputId: row?.id || '' };
  } catch (err) {
    console.error('report privacy gate save failed:', err);
    return { saved: false, reason: err.message };
  }
}

async function latestPrivacyGateApproval(clientDraftId, purpose) {
  const row = await getLatestIntakeOutput(clientDraftId, 'privacy_gate_admin_review');
  if (!row) return null;
  const payload = decryptJson(row.encrypted_payload);
  const approvedPurpose = String(payload.purpose || 'all');
  if (approvedPurpose === 'all' || approvedPurpose === purpose) return payload;
  return null;
}

async function approvePrivacyGate(clientDraftId, purpose = 'all', reviewNote = '') {
  const cleanPurpose = String(purpose || 'all').trim() || 'all';
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'privacy_gate_admin_review',
    encrypted_payload: encryptJson({
      approvedAt: new Date().toISOString(),
      purpose: cleanPurpose,
      reviewedBy: 'btai_admin',
      reviewNote: String(reviewNote || '').slice(0, 1000),
      approvalScope: cleanPurpose === 'all' ? 'all_privacy_gate_paused_payloads' : cleanPurpose
    })
  });
  await logReportEvent(clientDraftId, 'privacy_gate_admin_review_approved', 'success', privacyProofDefaults({
    privacyProofType: 'privacy_gate_admin_review',
    privacyGatePurpose: cleanPurpose,
    adminApprovedContinuation: true,
    reviewOutputId: row?.id || '',
    proofStatus: 'admin_review_approved'
  }));
  return { approved: true, purpose: cleanPurpose, outputId: row?.id || '' };
}

async function prepareSanitizedAiSource(clientDraftId, sourceText, purpose) {
  const shouldSanitizeOnly = String(purpose || '').startsWith('report_');
  const gate = runPrivacyGate(sourceText, { purpose, mode: shouldSanitizeOnly ? 'sanitize-only' : undefined });
  const saved = await savePrivacyGateRecord(clientDraftId, gate, purpose);
  await logReportEvent(clientDraftId, 'privacy_gate_scan_completed', saved.saved ? 'success' : 'failed', privacyProofDefaults(gateProofDetails(gate, {
    payloadType: 'encrypted_venture_dna_record',
    privacyGateOutputId: saved.outputId || '',
    privacyGateSaveReason: saved.reason || '',
    reportAiPayloadSanitizeOnly: shouldSanitizeOnly,
    proofStatus: saved.saved ? (gate.requiresReview ? 'review_required' : 'passed') : 'failed'
  })));

  if (!gate.requiresReview) {
    return { sanitizedText: gate.sanitizedText, gate, adminApproved: false };
  }

  const approval = await latestPrivacyGateApproval(clientDraftId, purpose);
  if (approval) {
    await logReportEvent(clientDraftId, 'privacy_gate_admin_review_used', 'success', privacyProofDefaults(gateProofDetails(gate, {
      payloadType: 'encrypted_venture_dna_record',
      privacyGateApprovalPurpose: approval.purpose || '',
      privacyGateApprovedAt: approval.approvedAt || '',
      adminApprovedContinuation: true,
      aiReceivesSanitizedPayloadOnly: true,
      proofStatus: 'admin_review_approved'
    })));
    return { sanitizedText: gate.sanitizedText, gate, adminApproved: true };
  }

  throw new PrivacyGateReviewError(
    'Privacy Gate review required before report generation can continue',
    gate,
    saved
  );
}

function priceLabel(envKey, fallback) {
  return process.env[envKey] || fallback;
}

function ctaLineHtml(label, url, description) {
  const safeLabel = escapeHtml(label);
  const safeDesc = escapeHtml(description || '');
  const line = url
    ? `<a href="${escapeHtml(url)}" style="color:#0d6e5e;font-weight:700;text-decoration:none;">${safeLabel}</a>`
    : `<strong>${safeLabel}</strong>`;
  return `<div style="margin-bottom:10px;">${line}${safeDesc ? `<br><span style="color:#4b5563;">${safeDesc}</span>` : ''}</div>`;
}

function paymentConfig() {
  return {
    level2Price: priceLabel('BTAI_LEVEL2_PRICE_LABEL', '$147 introductory'),
    level3Price: priceLabel('BTAI_LEVEL3_PRICE_LABEL', '$397 introductory'),
    level2Url: process.env.BTAI_LEVEL2_PAYMENT_URL || '',
    level3Url: process.env.BTAI_LEVEL3_PAYMENT_URL || '',
    consultUrl: process.env.BTAI_CONSULTATION_URL || ''
  };
}

function reportPrivacyStatement(tier = '') {
  if (tier === 'free') {
    return `## Privacy Note

Your raw interview stays in the secure record. Partners, where applicable, receive anonymized aggregate themes only, not your individual answers.`;
  }
  return `## How This Was Handled Privately

Your raw interview was not attached to this report. The working record is stored securely. Before AI analysis, identifiers we can detect—such as your name, business name, email, phone number and links—are replaced with placeholders and restored in your report. No detection method is perfect, so please avoid naming other people. The private re-identification map is encrypted at rest using AES-256-GCM.

If this intake was completed through a partner program, the partner does not receive your raw answers. Partner reporting is limited to anonymized aggregate themes where applicable. The purpose of this process is simple: use your answers to give you a useful report, while keeping the underlying interview record protected.`;
}

function clientUpgradeSection(tier) {
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  if (tier === 'btai') return '';
  if (tier === 'roadmap') {
    return `## Bridge To AI Implementation Support

This action plan gives the build direction, but the actual build still needs private scoping. That is where we confirm tools, data access, workflow details, privacy requirements, and what should be built first.

If you want Bridge To AI to help turn this into a working AI system or workbench, book a scoping conversation here:

${consultUrl || 'Reply to the Bridge To AI email thread to request implementation scoping.'}

A workbench is a private operating dashboard built around your business so repeated workflows can run from one place instead of being scattered across notes, spreadsheets, prompts, files, and tools.`;
  }
  return `## If You Want The Next Layer

If the snapshot feels accurate, the deeper interview is the no-payment context step. It helps Bridge To AI decide whether you need a paid report, action plan, workbench, or just a practical conversation.

- Continue the deeper interview: use the link in your report email.
- Paid reports, from ${level2Price}: best considered after the missing context is confirmed.
- Implementation/workbench support: ${consultUrl || 'reply to Bridge To AI to request a conversation.'}`;
}

function splitSentences(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map(sentence => sentence.trim())
    .filter(Boolean) || [];
}

function tightenBulletText(text = '') {
  const sentences = splitSentences(text);
  return (sentences.length ? sentences.slice(0, 2).join(' ') : String(text || '').trim())
    .replace(/\s+/g, ' ')
    .trim();
}

function enforceFreeQuickReadBullets(markdown) {
  const source = String(markdown || '').trim();
  const match = source.match(/(^|\n)##\s*1\.\s*Quick Read\s*\n/i);
  if (!match) return source;
  const sectionStart = (match.index || 0) + match[0].length;
  const nextMatch = source.slice(sectionStart).match(/\n##\s*2\.\s*/i);
  if (!nextMatch) return source;
  const sectionEnd = sectionStart + (nextMatch.index || 0);
  const before = source.slice(0, sectionStart);
  const section = source.slice(sectionStart, sectionEnd).trim();
  const after = source.slice(sectionEnd);
  const lines = section.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const hasBullets = lines.some(line => /^[-*]\s+/.test(line));
  if (hasBullets) {
    const tightenedLines = lines.map(line => {
      if (!/^[-*]\s+/.test(line)) return line;
      return `- ${tightenBulletText(line.replace(/^[-*]\s+/, '')).split(/(?<=[.!?])\s+/).slice(0, 1).join(' ')}`;
    });
    return `${before}${tightenedLines.join('\n')}\n${after}`;
  }

  let lead = lines.find(line => /^Here is what I am seeing\.?$/i.test(line)) || 'Here is what I am seeing.';
  const candidates = lines.filter(line => line !== lead);
  const bullets = candidates
    .map(tightenBulletText)
    .map(item => item.split(/(?<=[.!?])\s+/).slice(0, 1).join(' '))
    .filter(Boolean)
    .slice(0, 5);

  if (bullets.length < 3) return source;
  return `${before}${lead}\n\n${bullets.map(item => `- ${item}`).join('\n')}\n${after}`;
}

function shapeReportMarkdown(markdown, tier) {
  const polished = polishReportMarkdown(String(markdown || '').trim());
  return tier === 'free' ? enforceFreeQuickReadBullets(polished) : polished;
}

function decorateReportMarkdown(markdown, tier) {
  const sections = [shapeReportMarkdown(markdown, tier)];
  if (tier !== 'btai') sections.push(clientUpgradeSection(tier));
  sections.push(reportPrivacyStatement(tier));
  return sections.filter(Boolean).join('\n\n');
}

function polishReportMarkdown(markdown) {
  return String(markdown || '')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2013/g, ' - ')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00d7/g, 'x')
    .replace(/â€”|â€“/g, ' - ')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/Clear, emotionally resonant client outcome/g, 'You already know the real result')
    .replace(/A structured, deliberate sales process/g, 'Your sales process has a smart pause in it')
    .replace(/A defined, repeatable post-sale delivery flow/g, 'Delivery is already repeatable')
    .replace(/A brand voice that is genuinely distinct/g, 'Your client voice is already clear')
    .replace(/Self-awareness about the real constraint/g, 'You already named the real bottleneck')
    .replace(/Strong execution track record/g, 'You actually follow through')
    .replace(/\bgenuinely strong\b/gi, 'strong')
    .replace(/\bgenuinely differentiated\b/gi, 'clear and different')
    .replace(/\bemotionally resonant\b/gi, 'human and specific')
    .replace(/\bstrong foundation\b/gi, 'good starting point')
    .replace(/\bimplementation strategy\b/gi, 'build sequence')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scanReportPrivacy(markdown) {
  const text = String(markdown || '');
  const findings = [];
  const blockingFindings = [];
  const nonBlockingFindings = [];
  const checks = [
    ['email_address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, true],
    ['phone_number', /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/, true],
    ['credit_card_like_number', /\b(?:\d[ -]*?){13,19}\b/, true],
    ['private_financial_document_language', /\b(invoice|payroll|bank account|routing number|credit card|supplier contract|customer list|confidential formula)\b/i, false]
  ];
  checks.forEach(([type, pattern, blocksDelivery]) => {
    if (!pattern.test(text)) return;
    findings.push(type);
    if (blocksDelivery) blockingFindings.push(type);
    else nonBlockingFindings.push(type);
  });
  return {
    completed: true,
    rawSensitiveDataDetected: findings.length > 0,
    findings,
    blockingFindings,
    nonBlockingFindings,
    reportApprovedForClientDelivery: blockingFindings.length === 0
  };
}

const REPORT_COMPLETION_RULES = {
  free: [{
    expected: '9. Bridge To AI Note',
    variants: ['bridge to ai note', 'bridge to ai advisor note', 'note from bridge to ai']
  }],
  detailed: [{
    expected: '11. Final Advisor Note',
    variants: ['final advisor note', 'advisor note', 'final bridge to ai note']
  }],
  roadmap: [{
    expected: '19. Final Implementation Recommendation',
    variants: ['final implementation recommendation', 'implementation recommendation', 'final recommendation', 'recommended implementation path']
  }],
  btai: [{
    expected: '10. Needs Confirmation Before Build',
    variants: ['needs confirmation before build', 'needs confirmation', 'confirm before build', 'questions before build', 'what needs confirmation before build']
  }]
};

function normalizeHeadingText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[`*_>#|[\](){}:;,.!?'"-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCompletionAnchor(markdown, tier, rule) {
  const text = String(markdown || '');
  if (text.includes(`## ${rule.expected}`)) return { found: true, exact: true };
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const normalizedLines = lines.map(normalizeHeadingText);
  const tailStart = Math.max(0, Math.floor(normalizedLines.length * 0.65));
  const searchableLines = normalizedLines.slice(tailStart);
  const variants = [rule.expected, ...(rule.variants || [])].map(normalizeHeadingText).filter(Boolean);
  const foundVariant = variants.find(variant =>
    searchableLines.some(line => line.includes(variant)) ||
    normalizedLines.some(line => /^#+\s?/.test(lines[normalizedLines.indexOf(line)] || '') && line.includes(variant))
  );
  return { found: !!foundVariant, exact: false, variant: foundVariant || '' };
}

function reportQualityWarnings(markdown, tier) {
  const text = String(markdown || '').trim();
  const warnings = [];
  const requiredRules = REPORT_COMPLETION_RULES[tier] || [];
  requiredRules.forEach(rule => {
    const anchor = hasCompletionAnchor(text, tier, rule);
    if (!anchor.found) warnings.push(`missing_expected_final_section:${rule.expected}`);
    else if (!anchor.exact) warnings.push(`final_section_heading_variant:${rule.expected}`);
  });

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const lastMeaningfulLine = [...lines].reverse().find(line =>
    !/^[-*_]{3,}$/.test(line) &&
    !/^#+\s/.test(line) &&
    !/^\|/.test(line) &&
    !/^<\/?\w/.test(line)
  ) || '';
  const stripped = lastMeaningfulLine.replace(/[*_`>#-]/g, '').trim();
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 6) warnings.push('last_line_too_short_possible_cutoff');
  if (/\b(of|for|to|with|and|or|the|a|an|in|on|at|from|by|about|front of)$/i.test(stripped)) {
    warnings.push('last_line_ends_mid_thought');
  }
  if (!/[.!?)"]$/.test(stripped) && wordCount > 6) warnings.push('last_line_missing_sentence_punctuation');

  const repeatedPhrases = [
    'Here is what I am seeing',
    'That is not a criticism',
    'That is the real pinch point',
    'Here is the interesting part'
  ];
  repeatedPhrases.forEach(phrase => {
    const count = (text.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    if (count > 2) warnings.push(`overused_voice_phrase:${phrase}`);
  });

  const aiishPatterns = [
    ['generic_ai_phrase:genuinely_strong', /\bgenuinely strong\b/i],
    ['generic_ai_phrase:emotionally_resonant', /\bemotionally resonant\b/i],
    ['generic_ai_phrase:well_positioned', /\bwell positioned\b/i],
    ['generic_ai_phrase:significant_opportunity', /\bsignificant opportunity\b/i],
    ['generic_ai_phrase:implementation_strategy', /\bimplementation strategy\b/i],
    ['generic_ai_phrase:the_intake_indicates', /\bthe intake indicates\b/i]
  ];
  aiishPatterns.forEach(([warning, pattern]) => {
    if (pattern.test(text)) warnings.push(warning);
  });

  return warnings;
}

function validateReportCompletion(markdown, tier) {
  const warnings = reportQualityWarnings(markdown, tier);
  const blockingWarnings = warnings.filter(warning =>
    warning.startsWith('missing_expected_final_section:') ||
    warning === 'last_line_too_short_possible_cutoff' ||
    warning === 'last_line_ends_mid_thought'
  );
  return {
    completed: blockingWarnings.length === 0,
    warnings,
    blockingWarnings
  };
}

function canRepairCompletionFailure(completion) {
  const allowed = new Set([
    'last_line_too_short_possible_cutoff',
    'last_line_ends_mid_thought'
  ]);
  return (completion.blockingWarnings || []).every(warning =>
    allowed.has(warning) || warning.startsWith('missing_expected_final_section:')
  );
}

function expectedFinalSection(tier) {
  return REPORT_COMPLETION_RULES[tier]?.[0]?.expected || 'Final Bridge To AI Note';
}

function repairPromptForTier(tier, partialMarkdown, dna, blockingWarnings) {
  const finalSection = expectedFinalSection(tier);
  return `${sharedRules()}

You are repairing a Bridge To AI report that failed the completion quality gate.

Task:
- Keep the report grounded only in the Venture DNA and the already-generated report draft.
- Return the complete repaired markdown report only.
- Preserve the existing useful sections where possible.
- Complete any unfinished sentence or paragraph.
- Add or repair the final section heading exactly as:
## ${finalSection}
- The final section must be complete, plain-spoken, and must not end mid-thought.
- Do not add private financials, recipes, customer names beyond what is already appropriate for the report, supplier contracts, payroll details, invoices, or confidential formulas.
- Do not use markdown horizontal rules.

Completion gate warnings to fix:
${(blockingWarnings || []).map(warning => `- ${warning}`).join('\n')}

PARTIAL REPORT DRAFT:
${partialMarkdown}

VENTURE DNA:
${dna}`;
}

function trimIncompleteTail(markdown) {
  const lines = String(markdown || '').trim().split(/\r?\n/);
  while (lines.length) {
    const line = lines[lines.length - 1].trim();
    if (!line || /^[-*_]{3,}$/.test(line) || /^#+\s/.test(line) || /^\|/.test(line)) {
      lines.pop();
      continue;
    }
    const stripped = line.replace(/[*_`>#-]/g, '').trim();
    if (
      /\b(of|for|to|with|and|or|the|a|an|in|on|at|from|by|about|front of)$/i.test(stripped) ||
      (!/[.!?)"]$/.test(stripped) && stripped.split(/\s+/).filter(Boolean).length > 6)
    ) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

function deterministicFinalSection(tier) {
  if (tier === 'free') {
    return `## 9. Bridge To AI Note

This snapshot is meant to give you a useful first read, not a finished implementation plan. I would use it to see the likely opportunities, spot the first practical win, and decide whether the next layer is worth a deeper look.

The deeper report is where the work gets ranked, sequenced, and pressure-tested. That is where we look at what is ready now, what needs cleanup first, what should wait, and what the first 30 days should actually look like.`;
  }
  if (tier === 'detailed') {
    return `## 11. Final Advisor Note

The useful next step is not to automate everything. It is to choose the highest-value repeatable work, confirm the facts that are still missing, and start with the first project that gives the business real relief without creating new risk.

Where the information is clear, this report points to action. Where the information is thin, it marks the item for confirmation before anyone builds around it.`;
  }
  if (tier === 'roadmap') {
    return `## 19. Final Implementation Recommendation

I would treat this as a preliminary build sequence, not a final technical scope. The right next move is to confirm the data sources, privacy requirements, owner approvals, workflow details, and success measures before any automation is connected to live business operations.

Build the first workflow where the repeated work is clear, the risk is manageable, and the business can feel the time savings quickly. Clean up the foundation first anywhere the information underneath the workflow is not worth trusting yet.`;
  }
  return `## 10. Needs Confirmation Before Build

Before Bridge To AI scopes or builds from this record, confirm the current tools, data locations, privacy constraints, user permissions, workflow owners, and the business outcome that matters most.

Also confirm which recommendations are based on direct intake statements and which are directional signals. The build should only proceed once the key assumptions are verified with the client.`;
}

function applyDeterministicCompletion(markdown, tier) {
  const cleaned = trimIncompleteTail(markdown);
  const finalSection = deterministicFinalSection(tier);
  const finalHeading = expectedFinalSection(tier);
  if (hasCompletionAnchor(cleaned, tier, { expected: finalHeading, variants: REPORT_COMPLETION_RULES[tier]?.[0]?.variants || [] }).found) {
    return `${cleaned}\n\n${finalSection.replace(/^## .+?\n\n/s, '')}`;
  }
  return `${cleaned}\n\n${finalSection}`;
}

function sharedRules() {
  return `SOURCE OF TRUTH RULES:
- Use only the supplied Venture DNA markdown as source material.
- Do not invent facts, numbers, tools, revenue, team size, customer segments, timelines, pricing, workflow details, risks, client capabilities, or business claims.
- If information is missing, mark it as Needs Confirmation.
- Every inferred statement must be labeled exactly: [INFERRED].
- Use "Stated by the business", "Directional signal", "Inferred by BTAI", and "Requires private scoping to validate" where certainty matters.
- Treat the intake as a trust-first directional diagnostic. Do not create exact ROI, margin, payroll, costing, or revenue claims unless the Venture DNA explicitly includes them.
- If a recommendation depends on exact financials, recipes, invoices, supplier contracts, customer lists, or proprietary operating data, state that it requires private implementation scoping.
- Do not present inferred information as confirmed fact.
- Every meaningful paragraph must include at least one concrete detail from the Venture DNA file.
- The client is the hero. Bridge To AI is the guide.
- Avoid generic AI writing patterns, hype, and consultant filler.
- Keep Darren's voice. This is not optional. The report must sound like a practical business owner helping another business owner understand what is really going on.

DARREN'S VOICE AND TONE:
- Plain-spoken, practical, and curious.
- Warm, but not gushy.
- Direct, but not harsh.
- Honest, not flattering.
- Specific before polished.
- Business-first, AI-second.
- Write like a smart business owner talking over coffee, not like a consultant presenting an AI assessment.
- The goal is to help the owner see the real pinch point, understand what can be fixed, and feel less overwhelmed.
- Use short paragraphs. Usually 2-4 sentences.
- Prefer natural transitions: "Here is the interesting part", "I am starting to notice", "That is probably the real pinch point", "Let's work backwards", "Here is the part I would be careful with".
- Do not repeat the same Darren-style phrase more than twice in a report. If you use "Here is what I am seeing", "real pinch point", "not a criticism", or "interesting part", vary the next transitions.
- Use "you told us" or "you described" when grounding a point in the intake.
- Make time concrete. Time is the most valuable win because it is a non-replenishable asset.
- Use the owner-language distinction between working inside the business and working on the business when it fits the evidence.
- Remind the client that every person's time has a cost, including the owner's time, but do not invent hourly rates.
- Explain automation through business relief: fewer repeated steps, less rework, less owner bottleneck, more time for sales, customers, partnerships, planning, or higher-value work.
- When something is not ready for AI, say it plainly: "I would not automate this yet" or "I would clean this up first".
- If a process is weak, say: "That is not a criticism. It is just the thing to fix first."
- If data is messy, say: "Before we automate this, we need to make sure the thing underneath it is worth trusting."
- If data quality is a risk, use plain warnings like: "AI will just give you confident-sounding bad advice if the information underneath it is wrong."
- Keep Bridge To AI as the guide. Do not make AI sound like the hero.

DARREN'S AI OPPORTUNITY SELECTION RULE:
- Do not default to email automation as the top opportunity. Everyone says email automation. It may be correct, but it is the obvious answer and should only rank highly when the Venture DNA proves it is the real time sink.
- First look for the most valuable person in the business, or the most expensive person on the payroll, and identify where their time is being wasted.
- Look for repeated high-value work: pitch decks, presentations, proposals, onboarding material, client paperwork, project summaries, quote preparation, compliance documents, weekly planning, buyer readiness, SOP capture, sales prep, social media planning, and decision prep.
- Ask: where does automation save the most valuable time, reduce the most rework, or help the owner get back in front of customers?
- Saving five hours from a high-value person may matter more than saving fifteen minutes from a generic admin task.
- If the best opportunity is email, say why it is actually the best opportunity for this business. Do not recommend it because it is easy.
- For every ranked opportunity, prove why it belongs where it is ranked using evidence from the Venture DNA. If the proof is weak, lower the priority or mark it Needs Confirmation.

DO NOT WRITE LIKE GENERIC AI:
- Do not use: genuinely strong, significant opportunity, well positioned, robust, leverage, optimize, transform, unlock, strategic advantage, scalable framework, holistic, ecosystem, seamless, empower, game changer, best-in-class, next-level, high-impact, mission-critical, stakeholder alignment, operational excellence.
- Do not write polished consultant summaries like "the entire diagnosis", "structural risk", "sophisticated move", or "material opportunity" unless the client's own words make that plain and there is no simpler way to say it.
- Do not overuse "asset", "constraint", "infrastructure", "framework", "roadmap", "capacity", "strategic", "operational coordination", or "implementation strategy". Use plain words first.
- Do not write "the intake indicates" or "the business appears to be" when you can say "you told us", "what I am seeing", or "this looks like".
- Do not write "Bridge To AI recommends" over and over. Write like Darren: "I would start here", "I would be careful with this", "I would not automate this yet", "Here is where I would look first".
- Do not flatter. Useful truth beats polished reassurance.
- Do not make the report sound like it was written by a generic AI model.
- Do not use markdown horizontal rules (---). The HTML template already separates sections.
- Do not use fenced code blocks or ASCII-art diagrams. Use a plain bullet list or table instead.
- Do not use em dashes or special typography. Use commas, periods, colons, or simple hyphens so emailed and copied reports do not show broken characters.

VOICE REWRITE CHECK BEFORE FINAL ANSWER:
- Before returning the report, rewrite any paragraph that sounds like a polished AI consultant.
- Replace vague praise with a concrete observation from the intake.
- Replace corporate phrasing with plain language.
- Replace "AI can unlock..." with "AI could help by..."
- Replace "optimize" with "improve", "tighten", "clean up", or "make easier".
- Replace "leverage" with "use".
- Replace "significant opportunity" with the specific opportunity.
- Replace broad claims like "reduce administrative burden" with the actual repeated work from the Venture DNA.
- Replace "customer communication automation" with the specific communication job unless the intake proves that broad category is the real issue.
- Replace "strong foundation" with the exact thing that is working, such as repeat customers, a high close rate, a clear niche, a known customer problem, or a repeatable delivery process.
- Rewrite table row labels so they sound like plain observations, not consultant scorecard categories.
- Bad table labels: "Clear, emotionally resonant client outcome", "A structured, deliberate sales process", "A defined, repeatable post-sale delivery flow", "A brand voice that is genuinely distinct", "Self-awareness about the real constraint", "Strong execution track record".
- Better table labels: "You already know the real result", "Your sales process has a smart pause in it", "Delivery is already repeatable", "Your client voice is already clear", "You already named the real bottleneck", "You actually follow through".
- Table labels should feel like something Darren would say out loud, not like a consulting framework heading.
- If a paragraph could appear in any business report, rewrite it until it clearly belongs to this client.
- Before final output, check that the final client-facing section is complete and does not end mid-sentence. Never stop on an unfinished phrase.

WRITE LIKE THIS KIND OF PATTERN:
- "Here is what I am seeing."
- "This does not look like a sales problem. It looks like a getting-enough-good-conversations problem."
- "That is probably the real pinch point."
- "I could tell you to automate email, and that might help. But I would look first at where the most valuable person's time is getting eaten up."
- "Do not automate this yet. Clean up the information first, then the automation is worth trusting."
- "That is not a criticism. It is just the thing to fix first."

EVIDENCE-FIRST / NO-SYCOPHANCY STANDARD:
- Do not flatter the business, overstate readiness, or make the owner feel good at the expense of accuracy.
- The report should be encouraging, but it must be honest.
- If systems are weak, say so plainly and respectfully.
- If data is not clean enough for automation, say so.
- If the owner is the bottleneck, say so respectfully.
- If an AI idea is premature, state that it should wait.
- If an answer is thin or vague, mark the conclusion as Needs Confirmation or [INFERRED].
- Do not use generic praise such as "ahead of the curve", "well positioned", "strong foundation", or "exciting opportunity" unless the Venture DNA provides specific evidence.
- Prefer useful truth over polished reassurance: build this now, clean this up first, or do not automate this yet.
- A bad AI system does not save time. It just makes messy work move faster.`;
}

function promptForTier(tier, dna) {
  if (tier === 'free') {
    return `${sharedRules()}

Generate REPORT 1: Free AI Opportunity Snapshot.

Target: under 900 words in markdown. Prefer tight sections, short bullets, and compact tables.
Purpose: useful no-cost report that proves Bridge To AI understood the business.
Tone: client-facing, practical, plain-spoken, specific, and evidence-first. This should sound like Darren saying, "Here is what I noticed, here is the real pinch point, and here is what I would do first." Do not make this sound like an AI sales pitch or a consultant deck.
Important: the free report must impress through clarity, not volume. Its job is to show one likely first opportunity, the evidence behind it, and one useful next move. Do not give a full diagnosis.
Evidence style:
- Acknowledge what the client told us; do not keep repeating their words back to them.
- Use at most one short direct quote in the whole free report, and only if the exact wording matters.
- Prefer concise synthesis over recap. Assume the client remembers what they answered.
- Evidence should feel like "we heard you and understood the pattern," not like a transcript summary.
Paid-ladder boundary:
- The free report may name one primary opportunity and one backup opportunity only if needed.
- The free report must not fully rank the implementation sequence.
- The free report may give one first move, but it must not provide a full 30-day action plan.
- The free report may mention what appears ready or risky, but it must not deeply diagnose dependencies, numerical readiness scores, implementation phases, tool maps, ROI, time savings, or success metrics.
- The free report may invite a deeper report, but it should not sound like the build is already scoped or say things like "a few hours of build time" unless the Venture DNA directly proves that.
- The final Bridge To AI Note should be short. It should say the snapshot is directional and that the next layer ranks, sequences, and pressure-tests the work.
Opportunity rule: do not make email automation the default first opportunity. Look first for where the owner or highest-value person is losing time on repeated work. Only recommend email if the Venture DNA proves it is the real bottleneck.
Required snapshot artifact: include a section called "Snapshot Scorecard" near the top of the report. This is a directional scorecard, not a numeric score and not an ROI estimate. Use a markdown table with exactly these columns: Signal | Directional Read | What It Means | Evidence From Your Answers.
Use exactly five rows:
- Workflow Drag
- AI Fit
- Information Readiness
- Human Review Boundary
- First Useful Win
Allowed Directional Read phrases include: High friction, Medium friction, Good AI fit, Cleanup first, Ready to test, Human review needed, Needs confirmation. Pick the clearest plain-English phrase for each row.
Every row must be grounded in the Venture DNA. If the evidence is thin, use "Needs confirmation" and say what is missing. Do not invent exact hours saved, percentages, dollar savings, ROI, benchmark comparisons, readiness scores, or fake chart values.
Required free value moment: include one section called "Try This This Week". It must give one short, copy/paste-ready AI prompt or exercise the client can use with non-sensitive information. Keep the prompt under 170 words. The prompt must explicitly tell the client not to paste private financials, customer names, supplier names, recipes, payroll, invoices, contracts, confidential formulas, or other sensitive details into public AI tools.

Required structure:
# [Business Name] - Free AI Opportunity Snapshot
## 1. Quick Read
Write this as one short lead sentence followed by exactly 5 high-signal bullet points. Start with "Here is what I am seeing." Avoid "The intake indicates". Each bullet must be 1 sentence only. Cover the likely pinch point, first AI-fit workflow, readiness or cleanup issue, human-review boundary, and first useful move. Do not turn this into long paragraphs.
## 2. Snapshot Scorecard
Use the required 5-row scorecard table. Keep each cell short and specific. This should feel like the visual front door of the report.
## 3. Best First AI Opportunity
Write 1 short paragraph only. Name the one best first opportunity, why it appears to matter, and what should stay human-reviewed.
## 4. Try This This Week
Give one short, safe, copy/paste-ready AI prompt or exercise. Make it specific and useful this week. Keep the section under 180 words total.
## 5. What The Deeper Interview Would Confirm
Use 2 bullets only. Explain what still needs confirmation before Bridge To AI should rank the work, scope implementation, or recommend a workbench.

VENTURE DNA:
${dna}`;
  }

  if (tier === 'detailed') {
    return `${sharedRules()}

Generate REPORT 2: Detailed AI Readiness & Opportunity Report.

Target: 6-10 pages in markdown.
Purpose: paid mid-tier report. It must feel obviously more valuable than the free snapshot by doing work the free report does not do: ranked diagnosis, why each item is ranked, what is ready now, what needs cleanup first, what should not be automated yet, first 30-day action plan, risk/privacy/data concerns, success measures, and questions to confirm before implementation.
Tone: practical advisor, not corporate consultant. Keep it direct, useful, and grounded. If something should wait, say so. If something needs cleanup first, say so.
Opportunity rule: rank opportunities by valuable time saved, rework reduced, revenue conversations created, and readiness to implement. Do not over-rank email automation unless it is clearly the highest-value repeated work in the Venture DNA.
Paid-value standard:
- A reader should feel: "The free report helped me see the problem. This paid report helps me decide what to do first, what not to do yet, and what I would hand to someone before starting implementation."
- Every ranked opportunity must explain why it sits above or below the others.
- Clearly separate ready-now opportunities from cleanup-first opportunities.
- Include practical "do not automate this yet" advice where the foundation is not ready.
- The 30-day plan must be more specific than the free report's single first move.
- The final note should reinforce the implementation logic, not repeat the free report's closing note.

Required structure:
# [Business Name] - Detailed AI Readiness & Opportunity Report
## 1. Quick Read
## 2. Business Positioning
## 3. Current Revenue And Growth Model
Use a table: Revenue Stream | Current State | Growth Opportunity | AI Relevance
## 4. Main Growth Leaks
Use a table: Growth Leak | What Is Happening | Business Impact | Recommended Fix
## 5. Where AI Looks Useful First
Use a ranked table: Rank | AI Opportunity | Problem Solved | Impact | Feasibility | Priority | Notes
After the table, explain the ranking logic in plain English. Say why the top item is first, why the second/third items wait, and what would change the order.
## 6. Recommended First 5 AI Projects
Use a table: Priority | Project | Business Problem Solved | Client Benefit | Complexity | Suggested Timing
## 7. Readiness Scorecard
Score Data & Information Quality, Workflow Documentation, Tools & Tech Stack, People & Change Readiness, Risk & Compliance Posture from 1-5.
For each score, state whether it is ready now, cleanup first, or needs confirmation.
## 8. 30-Day Action Plan
Use a table: Week | Action | Owner | Output | Success Measure
This section must contain specific actions, not generic planning language.
## 9. Directional Success Metrics
Include what would count as a useful win without inventing exact ROI.
## 10. Recommended Bridge To AI Next Step
Make the next step practical and scoped. Do not oversell.
## 11. Final Advisor Note
Explain the paid-report value in plain terms: this report ranks the work, identifies what should wait, and gives the first 30-day path. Do not repeat the Level 1 Bridge To AI Note.

VENTURE DNA:
${dna}`;
  }

  if (tier === 'btai') {
    return `${sharedRules()}

Generate INTERNAL REPORT 4: BTAI Advisor Brief.

Audience: Bridge To AI only. This is not client-facing.
Purpose: give Darren a practical pre-call briefing so he can ask better questions, clarify needs, spot risk, and identify the strongest commercial path without needing to expose or pass around the raw Venture DNA markdown.
Target: 4-7 pages in markdown.
Tone: direct, advisory, specific, commercially useful, and written like notes Darren would actually use before a call.

Required structure:
# [Business Name] - BTAI Advisor Brief
## 1. One-Page Situation Read
Summarize what BTAI needs to understand before the debrief.
## 2. Highest-Value Clarifying Questions
Use a table: Question | Why It Matters | What A Strong Answer Would Reveal | What To Listen For
## 3. Client Readiness And Trust Signals
Use a table: Signal | Evidence From Intake | Advisor Interpretation | Follow-Up Needed
## 4. Likely Buying Motivation
Label all unconfirmed motivation as [INFERRED].
## 5. Strongest AI Opportunity Angles
Use a table: Angle | Business Value | Why It Fits | Proof Needed
## 6. Risk, Privacy, And Data Sensitivity Notes
Use a table: Risk | Why It Matters | How BTAI Should Handle It
## 7. Scope Control Notes
Identify what BTAI should not promise yet.
## 8. Discovery Call Talk Track
Provide a concise opening, 5-8 question sequence, and a closing recommendation.
## 9. Proposal Direction
Use a table: Offer Path | Fit | Conditions | Price/Scope Notes
## 10. Needs Confirmation Before Build

VENTURE DNA:
${dna}`;
  }

  return `${sharedRules()}

Generate REPORT 3: Preliminary AI Action Plan.

Target: 10-18 pages in markdown.
Purpose: premium preliminary action plan around $297. It must give a practical implementation sequence a non-technical business owner could act on, while clearly marking what still requires private scoping before BTAI can validate exact ROI, cost, data access, or build scope.
Tone: practical implementation advisor. Plain English. No hype. No generic AI transformation language. Make the client feel like the path is understandable, not like they are reading software consulting copy.
Opportunity rule: build the implementation path around the most valuable repeated work first. Look for owner bottlenecks, high-cost staff time, repeated client-specific work, documentation gaps, and decision-prep work before suggesting generic admin automation.

Required structure:
# [Business Name] - Preliminary AI Action Plan
## 1. What I Would Build Around
## 2. Context Snapshot
Use a table: Category | Detail
## 3. Missing Answers From Updated Intake Questions
## 4. Target Operating Model
Use a simple adapted flow.
## 5. Build Order
Use a ranked table: Rank | System / Workflow | Problem Solved | Why Now | Business Impact | Owner/Team Relief | Complexity | Dependencies | Recommended Tool Stack | First Deliverable
## 6. Build 1: Highest-Priority Workflow
## 7. Build 2: Second-Priority Workflow
## 8. Build 3: Third-Priority Workflow
## 9. Build 4: Supporting Automation Or Intelligence Layer
## 10. Build 5: Future Enhancement
## 11. Data, Tools, And Integration Map
Use a table: Current Tool / Data Source | What It Contains | Current Issue | AI Opportunity | Integration Priority | Risk Level
## 12. Voice, Brand, And Judgment Guardrails
## 13. Risk Controls
Use a table: Risk | Why It Matters | Severity | Mitigation | Owner
## 14. Do Now / Build Next / Avoid For Now
## 15. 30 / 60 / 90 Day Implementation Plan
## 16. Directional Success Metrics And ROI Assumptions
Clearly separate Stated by the business, Directional signal, [INFERRED], and Requires private scoping to validate.
## 17. Questions To Confirm In Private Scoping Before Build
## 18. Consulting Handoff Recommendation
## 19. Final Implementation Recommendation

VENTURE DNA:
${dna}`;
}

function normalizeReportFormats(value) {
  const raw = Array.isArray(value) ? value : String(value || 'html').split(',');
  const selected = raw.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
  if (selected.includes('all')) return ['html', 'docx', 'md'];
  const allowed = ['html', 'docx', 'md'];
  const formats = Array.from(new Set(selected.filter(item => allowed.includes(item))));
  return formats.length ? formats : ['html'];
}

function formatKey(formats) {
  return normalizeReportFormats(formats).join(',');
}

async function generateOne(clientDraftId, tier, options = {}) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const formats = normalizeReportFormats(options.formats || 'html');
  const includeDocx = formats.includes('docx');

  const startedAt = Date.now();
  const { dnaContent, meta } = await getDna(clientDraftId);
  const gatedSource = await prepareSanitizedAiSource(clientDraftId, dnaContent, `report_${tier}_generation`);
  const identitySource = await redactReportSource(clientDraftId, gatedSource.sanitizedText, meta);
  const businessName = businessNameFromDna(dnaContent);
  await logReportEvent(clientDraftId, 'report_generation_started', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    payloadType: 'sanitized_venture_dna_record',
    privacyGate: publicGateSummary(gatedSource.gate),
    identityRedaction: { detectionMode: 'heuristic', source: identitySource.source, stats: identitySource.stats },
    privacyGateAdminApproved: !!gatedSource.adminApproved,
    startedAt: new Date(startedAt).toISOString()
  }));
  let generatedMarkdown = await callClaude(promptForTier(tier, identitySource.text), spec.maxTokens);
  let completion = validateReportCompletion(generatedMarkdown, tier);
  if (!completion.completed) {
    await logReportEvent(clientDraftId, 'report_generation_quality_gate_failed', 'failed', privacyProofDefaults({
      partner: meta?.sourceMeta?.partner || 'BTAI',
      campaign: meta?.sourceMeta?.campaign || 'general_intake',
      reportTier: tier,
      reportOutputType: spec.htmlOutputType,
      payloadType: 'generated_report_markdown',
      qualityGateWarnings: completion.warnings,
      blockingWarnings: completion.blockingWarnings,
      generationMs: Date.now() - startedAt
    }));
    if (canRepairCompletionFailure(completion)) {
      const originalBlockingWarnings = [...completion.blockingWarnings];
      const originalWarnings = [...completion.warnings];
      await logReportEvent(clientDraftId, 'report_generation_repair_started', 'success', privacyProofDefaults({
        partner: meta?.sourceMeta?.partner || 'BTAI',
        campaign: meta?.sourceMeta?.campaign || 'general_intake',
        reportTier: tier,
        reportOutputType: spec.htmlOutputType,
        payloadType: 'generated_report_markdown',
        repairReason: originalBlockingWarnings,
        generationMs: Date.now() - startedAt
      }));
      const repairedMarkdown = await callClaude(
        repairPromptForTier(tier, generatedMarkdown, identitySource.text, originalBlockingWarnings),
        Math.max(1800, Math.min(3200, Math.floor(spec.maxTokens * 0.6)))
      );
      const repairedCompletion = validateReportCompletion(repairedMarkdown, tier);
      if (repairedCompletion.completed) {
        generatedMarkdown = repairedMarkdown;
        completion = {
          completed: true,
          warnings: Array.from(new Set([...originalWarnings, ...repairedCompletion.warnings, 'completion_repaired'])),
          blockingWarnings: []
        };
        await logReportEvent(clientDraftId, 'report_generation_repair_completed', 'success', privacyProofDefaults({
          partner: meta?.sourceMeta?.partner || 'BTAI',
          campaign: meta?.sourceMeta?.campaign || 'general_intake',
          reportTier: tier,
          reportOutputType: spec.htmlOutputType,
          payloadType: 'generated_report_markdown',
          originalBlockingWarnings,
          repairedWarnings: repairedCompletion.warnings,
          generationMs: Date.now() - startedAt
        }));
      } else {
        await logReportEvent(clientDraftId, 'report_generation_repair_failed', 'failed', privacyProofDefaults({
          partner: meta?.sourceMeta?.partner || 'BTAI',
          campaign: meta?.sourceMeta?.campaign || 'general_intake',
          reportTier: tier,
          reportOutputType: spec.htmlOutputType,
          payloadType: 'generated_report_markdown',
          repairWarnings: repairedCompletion.warnings,
          repairBlockingWarnings: repairedCompletion.blockingWarnings,
          generationMs: Date.now() - startedAt
        }));
        const deterministicMarkdown = applyDeterministicCompletion(repairedMarkdown || generatedMarkdown, tier);
        const deterministicCompletion = validateReportCompletion(deterministicMarkdown, tier);
        if (deterministicCompletion.completed) {
          generatedMarkdown = deterministicMarkdown;
          completion = {
            completed: true,
            warnings: Array.from(new Set([
              ...originalWarnings,
              ...repairedCompletion.warnings,
              ...deterministicCompletion.warnings,
              'deterministic_completion_added'
            ])),
            blockingWarnings: []
          };
          await logReportEvent(clientDraftId, 'report_generation_deterministic_completion_added', 'success', privacyProofDefaults({
            partner: meta?.sourceMeta?.partner || 'BTAI',
            campaign: meta?.sourceMeta?.campaign || 'general_intake',
            reportTier: tier,
            reportOutputType: spec.htmlOutputType,
            payloadType: 'generated_report_markdown',
            originalBlockingWarnings,
            repairBlockingWarnings: repairedCompletion.blockingWarnings,
            deterministicWarnings: deterministicCompletion.warnings,
            generationMs: Date.now() - startedAt
          }));
        } else {
          await logReportEvent(clientDraftId, 'report_generation_deterministic_completion_failed', 'failed', privacyProofDefaults({
            partner: meta?.sourceMeta?.partner || 'BTAI',
            campaign: meta?.sourceMeta?.campaign || 'general_intake',
            reportTier: tier,
            reportOutputType: spec.htmlOutputType,
            payloadType: 'generated_report_markdown',
            originalBlockingWarnings,
            repairBlockingWarnings: repairedCompletion.blockingWarnings,
            deterministicBlockingWarnings: deterministicCompletion.blockingWarnings,
            generationMs: Date.now() - startedAt
          }));
          throw new Error(`Report quality gate failed for ${tier}: ${repairedCompletion.blockingWarnings.join(', ')}`);
        }
      }
    } else {
      throw new Error(`Report quality gate failed for ${tier}: ${completion.blockingWarnings.join(', ')}`);
    }
  }
  const markdown = decorateReportMarkdown(reidentify(generatedMarkdown, identitySource.mapping), tier);
  const validation = validateDnaOutput(markdown, { requireEvidenceLabels: false });
  validation.warnings = [...(validation.warnings || []), ...completion.warnings];
  const privacyScan = scanReportPrivacy(markdown);
  const htmlReport = createReportHtml(markdown, {
    title: `${businessName} - ${spec.title}`,
    businessName,
    tierLabel: spec.title,
    generatedAt: new Date().toISOString(),
    intakeVersion: APP_VERSION,
    reportTier: tier
  });
  await logReportEvent(clientDraftId, 'report_privacy_scan_completed', privacyScan.reportApprovedForClientDelivery ? 'success' : 'warning', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    reportPrivacyScanCompleted: true,
    rawSensitiveDataDetected: privacyScan.rawSensitiveDataDetected,
    reportApprovedForClientDelivery: privacyScan.reportApprovedForClientDelivery,
    privacyScanFindings: privacyScan.findings,
    blockingFindings: privacyScan.blockingFindings,
    nonBlockingFindings: privacyScan.nonBlockingFindings
  }));
  const mdRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.outputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      markdown,
      privacyGate: publicGateSummary(gatedSource.gate),
      validation,
      privacyScan
    })
  });

  let docxRow = null;
  if (includeDocx) {
    const docx = createDocxBuffer(markdown);
    docxRow = await insertIntakeOutput({
      client_draft_id: clientDraftId,
      output_type: spec.docxOutputType,
      encrypted_payload: encryptJson({
        createdAt: new Date().toISOString(),
        tier,
        businessName,
        filename: `${businessName}_${spec.filename}.docx`,
        contentBase64: docx.toString('base64'),
        privacyGate: publicGateSummary(gatedSource.gate),
        validation,
        privacyScan
      })
    });
  }

  const htmlRow = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.htmlOutputType,
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      tier,
      businessName,
      filename: `${businessName}_${spec.filename}.html`,
      contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
      contentType: 'text/html; charset=utf-8',
      privacyGate: publicGateSummary(gatedSource.gate),
      validation,
      privacyScan
    })
  });

  await logReportEvent(clientDraftId, 'report_generated', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    warningCount: validation.warnings?.length || 0,
    payloadType: includeDocx ? 'client_report_html_docx_and_markdown' : 'client_report_html_and_markdown',
    exportFormats: formats,
    privacyGateDecision: gatedSource.gate.decision,
    privacyGateRiskLevel: gatedSource.gate.summary.riskLevel,
    generationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  return {
    generated: true,
    tier,
    businessName,
    privacyGate: publicGateSummary(gatedSource.gate),
    markdownOutputId: mdRow?.id || '',
    docxOutputId: docxRow?.id || '',
    htmlOutputId: htmlRow?.id || '',
    warnings: validation.warnings || []
  };
}

async function getOrGenerateOne(clientDraftId, tier, forceRegenerate = false, options = {}) {
  const formats = normalizeReportFormats(options.formats || 'html');
  const includeHtml = formats.includes('html');
  const includeDocx = formats.includes('docx');
  if (forceRegenerate) return generateOne(clientDraftId, tier, { formats });
  const includeMd = formats.includes('md');
  let existingHtml = await loadGenerated(clientDraftId, tier, 'html');
  let existingDocx = await loadGenerated(clientDraftId, tier, 'docx');
  const existingMd = await loadGeneratedMarkdown(clientDraftId, tier);
  let convertedHtml = false;
  let convertedDocx = false;

  if (includeHtml && !existingHtml?.contentBase64 && existingMd?.markdown) {
    existingHtml = await ensureHtmlReport(clientDraftId, tier);
    convertedHtml = !!existingHtml?.contentBase64;
  }

  if (includeDocx && !existingDocx?.contentBase64 && existingMd?.markdown) {
    existingDocx = await ensureDocxReport(clientDraftId, tier);
    convertedDocx = !!existingDocx?.contentBase64;
  }

  const ready =
    (!includeHtml || !!existingHtml?.contentBase64) &&
    (!includeDocx || !!existingDocx?.contentBase64) &&
    (!includeMd || !!existingMd?.markdown);

  if (ready) {
    return {
      generated: false,
      convertedHtml,
      convertedDocx,
      tier,
      businessName: existingHtml?.businessName || existingDocx?.businessName || existingMd?.businessName || '',
      markdownOutputId: existingMd ? 'existing' : '',
      docxOutputId: existingDocx ? 'existing' : '',
      htmlOutputId: existingHtml ? 'existing' : '',
      warnings: existingHtml?.validation?.warnings || existingDocx?.validation?.warnings || existingMd?.validation?.warnings || []
    };
  }

  return generateOne(clientDraftId, tier, { formats });
}

async function loadGenerated(clientDraftId, tier, format = 'docx') {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const outputType = format === 'html' ? spec.htmlOutputType : spec.docxOutputType;
  const row = await getLatestIntakeOutput(clientDraftId, outputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function loadGeneratedMarkdown(clientDraftId, tier) {
  const spec = REPORTS[tier];
  if (!spec) throw new Error(`Unknown report tier: ${tier || 'blank'}`);
  const row = await getLatestIntakeOutput(clientDraftId, spec.outputType);
  if (!row) return null;
  return decryptJson(row.encrypted_payload);
}

async function ensureHtmlReport(clientDraftId, tier) {
  const existingHtml = await loadGenerated(clientDraftId, tier, 'html');
  if (existingHtml?.contentBase64) return existingHtml;
  const spec = REPORTS[tier];
  const markdownRecord = await loadGeneratedMarkdown(clientDraftId, tier);
  if (!markdownRecord?.markdown) return null;
  const businessName = markdownRecord.businessName || businessNameFromDna(markdownRecord.markdown);
  const htmlReport = createReportHtml(markdownRecord.markdown, {
    title: `${businessName} - ${spec.title}`,
    businessName,
    tierLabel: spec.title,
    generatedAt: markdownRecord.createdAt || new Date().toISOString(),
    intakeVersion: APP_VERSION,
    reportTier: tier
  });
  const payload = {
    createdAt: new Date().toISOString(),
    tier,
    businessName,
    filename: `${businessName}_${spec.filename}.html`,
    contentBase64: Buffer.from(htmlReport, 'utf8').toString('base64'),
    contentType: 'text/html; charset=utf-8',
    validation: markdownRecord.validation || null,
    privacyScan: markdownRecord.privacyScan || null,
    convertedFromMarkdown: true
  };
  await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.htmlOutputType,
    encrypted_payload: encryptJson(payload)
  });
  await logReportEvent(clientDraftId, 'report_html_generated_from_markdown', 'success', privacyProofDefaults({
    reportTier: tier,
    reportOutputType: spec.htmlOutputType,
    payloadType: 'client_report_html',
    rawDnaIncluded: false
  }));
  return payload;
}

async function ensureDocxReport(clientDraftId, tier) {
  const existingDocx = await loadGenerated(clientDraftId, tier, 'docx');
  if (existingDocx?.contentBase64) return existingDocx;
  const spec = REPORTS[tier];
  const markdownRecord = await loadGeneratedMarkdown(clientDraftId, tier);
  if (!markdownRecord?.markdown) return null;
  const businessName = markdownRecord.businessName || businessNameFromDna(markdownRecord.markdown);
  const docx = createDocxBuffer(markdownRecord.markdown);
  const payload = {
    createdAt: new Date().toISOString(),
    tier,
    businessName,
    filename: `${businessName}_${spec.filename}.docx`,
    contentBase64: docx.toString('base64'),
    validation: markdownRecord.validation || null,
    privacyScan: markdownRecord.privacyScan || null,
    convertedFromMarkdown: true
  };
  await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: spec.docxOutputType,
    encrypted_payload: encryptJson(payload)
  });
  await logReportEvent(clientDraftId, 'report_docx_generated_from_markdown', 'success', privacyProofDefaults({
    reportTier: tier,
    reportOutputType: spec.docxOutputType,
    payloadType: 'client_report_docx',
    rawDnaIncluded: false
  }));
  return payload;
}

async function buildZip(clientDraftId, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const key = formatKey(formats);
  const includeHtml = formats.includes('html');
  const includeDocx = formats.includes('docx');
  const includeMd = formats.includes('md');
  const { dnaContent, meta } = await getDna(clientDraftId);
  const businessName = businessNameFromDna(dnaContent);
  const files = [];
  const missingFiles = [];

  for (const tier of ['free', 'detailed', 'roadmap', 'btai']) {
    const htmlDoc = includeHtml ? await ensureHtmlReport(clientDraftId, tier) : null;
    const mdDoc = includeMd ? await loadGeneratedMarkdown(clientDraftId, tier) : null;
    const doc = includeDocx ? await ensureDocxReport(clientDraftId, tier) : null;
    let includedForTier = 0;

    if (includeHtml && htmlDoc?.contentBase64) {
      files.push({
        name: `HTML_Reports/${htmlDoc.filename || `${businessName}_${REPORTS[tier].filename}.html`}`,
        content: Buffer.from(htmlDoc.contentBase64, 'base64')
      });
      includedForTier += 1;
    } else if (includeHtml) {
      missingFiles.push(`${tier}: HTML`);
    }

    if (includeDocx && doc?.contentBase64) {
      files.push({
        name: `DOCX_Backup/${doc.filename || `${businessName}_${REPORTS[tier].filename}.docx`}`,
        content: Buffer.from(doc.contentBase64, 'base64')
      });
      includedForTier += 1;
    } else if (includeDocx) {
      missingFiles.push(`${tier}: DOCX`);
    }

    if (includeMd && mdDoc?.markdown) {
      files.push({
        name: `MD_Reports/${businessName}_${REPORTS[tier].filename}.md`,
        content: mdDoc.markdown
      });
      includedForTier += 1;
    } else if (includeMd) {
      missingFiles.push(`${tier}: Markdown`);
    }

    if (includedForTier === 0) {
      throw new Error(`Missing selected report files for tier: ${tier}. Generate that report first, then download the ZIP.`);
    }
  }

  const validationSummary = {
    createdAt: new Date().toISOString(),
    clientDraftId,
    businessName,
    formats,
    formatKey: key,
    includedFiles: files.map(f => f.name),
    rawDnaIncluded: false,
    partnerRawAccess: false,
    encryptedSourceRecord: true,
    privacyProof: true,
    missingFiles,
    note: `Reports were retrieved or generated from the encrypted Venture DNA record and stored encrypted before ZIP retrieval. Selected export format(s): ${formats.join(', ')}. The raw Venture DNA markdown is intentionally not included in this ZIP.`
  };
  files.push({ name: 'BTAI_Report_Pack_Summary.md', content: reportPackSummaryMarkdown({ clientDraftId, businessName, files }) });
  files.push({ name: 'validation-summary.json', content: JSON.stringify(validationSummary, null, 2) });

  const zip = createZipBuffer(files);
  const row = await insertIntakeOutput({
    client_draft_id: clientDraftId,
    output_type: 'three_report_pack_zip',
    encrypted_payload: encryptJson({
      createdAt: new Date().toISOString(),
      filename: `${businessName}_BTAI_Report_Pack.zip`,
      contentBase64: zip.toString('base64'),
      formats,
      formatKey: key,
      validationSummary
    })
  });

  await logReportEvent(clientDraftId, 'report_pack_zip_built', 'success', privacyProofDefaults({
    partner: meta?.sourceMeta?.partner || 'BTAI',
    campaign: meta?.sourceMeta?.campaign || 'general_intake',
    zipReady: true,
    exportFormats: formats,
    formatKey: key,
    includedFileCount: files.length,
    rawDnaIncluded: false,
    payloadType: 'client_report_zip'
  }));

  return {
    ready: true,
    outputId: row?.id || '',
    filename: `${businessName}_BTAI_Report_Pack.zip`,
    contentBase64: zip.toString('base64')
  };
}

async function generateAll(clientDraftId, forceRegenerate = false, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const tiers = ['free', 'detailed', 'roadmap', 'btai'];
  await logReportEvent(clientDraftId, 'report_pack_batch_started', 'success', privacyProofDefaults({ tiers, forceRegenerate, exportFormats: formats, payloadType: 'encrypted_venture_dna_record' }));
  const results = await Promise.all(tiers.map(tier => getOrGenerateOne(clientDraftId, tier, forceRegenerate, { formats })));
  const zip = await buildZip(clientDraftId, formats);
  await logReportEvent(clientDraftId, 'report_pack_batch_complete', 'success', privacyProofDefaults({
    tiers,
    zipOutputId: zip.outputId || '',
    generatedCount: results.filter(r => r.generated).length,
    exportFormats: formats,
    forceRegenerate
  }));
  return { ready: true, results, zip };
}

function assertPreviewRecipientAllowed(email) {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() !== 'preview') return;
  const allowed = String(process.env.BTAI_PREVIEW_REPORT_RECIPIENTS || '')
    .split(',')
    .map(value => normalizeEmail(value))
    .filter(Boolean);
  if (!allowed.length) {
    throw new Error('Preview report recipients are not configured');
  }
  if (!allowed.includes(normalizeEmail(email))) {
    throw new Error('This email address is not approved for Preview report delivery');
  }
}

async function sendFreeReportEmail({ clientDraftId, clientEmail, clientName, businessName, reportFile }) {
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const bccRecipient = process.env.INTAKE_BCC_RECIPIENT || '';
  assertPreviewRecipientAllowed(clientEmail);
  const { level2Price, level3Price, level2Url, level3Url, consultUrl } = paymentConfig();
  const configuredPublicBaseUrl = String(process.env.BTAI_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'preview' && !configuredPublicBaseUrl) {
    throw new Error('Preview public base URL is not configured');
  }
  const publicBaseUrl = configuredPublicBaseUrl || 'https://intake.bridgetoai.ca';
  const continueInterviewUrl = `${publicBaseUrl}/snapshot`;
  const showUpsellLinks = String(process.env.BTAI_ENABLE_UPSELL_LINKS || '').toLowerCase() === 'true';
  const lockMarkUrl = `${publicBaseUrl}/assets/brand/sil-lock-mark.png`;
  const trustSealUrl = `${publicBaseUrl}/assets/brand/sil-trust-seal.png`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <div style="background:#075648;padding:22px 30px;border-radius:12px 12px 0 0;border-bottom:5px solid #f3c74d;">
        <div style="display:flex;align-items:center;gap:13px;">
          <img src="${lockMarkUrl}" alt="" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:contain;">
          <div>
            <div style="color:#dff7ef;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;margin-bottom:4px;">Bridge To AI</div>
            <h1 style="color:#fff;font-size:21px;line-height:1.3;margin:0;">Your opportunity snapshot is ready</h1>
          </div>
        </div>
      </div>
      <div style="border:1px solid #d9e7e3;border-top:0;padding:26px 30px;border-radius:0 0 12px 12px;background:#fafaf8;">
        <p style="font-size:15px;line-height:1.6;margin-top:0;">Hi ${escapeHtml(clientName || 'there')},</p>
        <p style="font-size:15px;line-height:1.6;">Thank you for completing the free interview. Your AI Opportunity Snapshot is attached as a clean HTML report you can read in your browser or print.</p>
        <p style="font-size:15px;line-height:1.6;">Inside, you will see a Snapshot Scorecard, the likely first AI opportunity, what should stay human-reviewed, and one safe prompt or next move you can try without putting sensitive details into a public AI tool.</p>
        <p style="font-size:15px;line-height:1.6;">Bridge To AI exists for business owners who do not want to become AI experts before they can benefit from AI. I learned the AI side so you do not have to, and the goal is to translate your real workflow into practical next steps you can actually use.</p>
        <p style="font-size:15px;line-height:1.6;">This first report is intentionally practical and directional. It avoids private financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential formulas.</p>
        <div style="display:flex;gap:14px;align-items:center;background:#ffffff;border:1px solid #d9e7e3;border-radius:10px;padding:12px 14px;margin:0 0 16px;">
          <img src="${trustSealUrl}" alt="Secure Intelligence Layer" width="68" height="68" style="display:block;width:68px;height:68px;object-fit:contain;flex:0 0 auto;">
          <div style="font-size:13px;line-height:1.45;color:#374151;">
            <strong style="display:block;color:#075648;margin-bottom:3px;">Handled through the Bridge To AI Secure Intelligence Layer</strong>
            Encrypted intake, controlled use, privacy-aware AI processing, and private report delivery.
          </div>
        </div>
        <div style="background:#e8f4f1;border:1px solid #b8ddd7;border-radius:10px;padding:14px 16px;color:#0d6e5e;font-size:14px;line-height:1.5;margin-bottom:16px;">
          <strong>Best next step:</strong> Review the snapshot first. If it feels accurate, continue the deeper interview so Bridge To AI can understand the missing context and guide you more precisely before anyone talks about a paid report or build.
        </div>
        <div style="border:1px solid #e4e2dd;border-radius:10px;padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55;">
          <strong style="display:block;margin-bottom:8px;color:#111827;">What this snapshot does not fully cover yet</strong>
          <div style="margin-bottom:10px;">The free report gives you a directional scorecard and first useful move. The deeper interview is not a payment step. It is the context step that helps Bridge To AI understand whether you need a report, an action plan, a workbench, or simply a practical conversation.</div>
          ${ctaLineHtml('Return to the private intake', continueInterviewUrl, 'If you want to continue, return from the same browser and device you used for this interview. No payment is required to add the missing context.')}
          <div style="margin-bottom:10px;color:#6b7280;font-size:13px;">Privacy note: continue only from the same browser and device where you started the interview. Please do not forward this email.</div>
          ${showUpsellLinks ? ctaLineHtml(`Detailed AI Opportunity Report - ${level2Price}`, '', 'Best considered after the deeper interview confirms enough detail for ranking and first projects.') : ''}
          ${showUpsellLinks ? ctaLineHtml(`Preliminary AI Action Plan - ${level3Price}`, '', 'Best considered after workflow priorities, risk controls, and scoping questions are clearer.') : ''}
          ${showUpsellLinks ? ctaLineHtml('Talk with Bridge To AI about implementation or a custom workbench', consultUrl, 'Useful if you already know you want help turning the opportunity into a working system.') : ''}
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:0;margin-top:18px;">Built with Bridge To AI Intake ${escapeHtml(APP_VERSION)}</p>
      </div>
    </div>`;
  const text = `Your Bridge To AI opportunity snapshot is ready.\n\nThe free report is attached. Inside, you will see a Snapshot Scorecard, the likely first AI opportunity, what should stay human-reviewed, and one safe prompt or next move you can try without putting sensitive details into a public AI tool.\n\nBridge To AI exists for business owners who do not want to become AI experts before they can benefit from AI. I learned the AI side so you do not have to, and the goal is to translate your real workflow into practical next steps you can actually use.\n\nHandled through the Bridge To AI Secure Intelligence Layer: encrypted intake, controlled use, privacy-aware AI processing, and private report delivery.\n\nWhat this snapshot does not fully cover yet:\nThe free report gives you a directional scorecard and first useful move. The deeper interview is not a payment step. It is the context step that helps Bridge To AI understand whether you need a report, an action plan, a workbench, or simply a practical conversation.\n\nBest next step:\n- Return to the private intake from the same browser and device: ${continueInterviewUrl}\nNo payment is required to add the missing context.\n\nPrivacy note: continue only from the same browser and device where you started the interview. Please do not forward this email.\n\n${showUpsellLinks ? `Possible next steps after context is clearer:\n- Detailed AI Opportunity Report - ${level2Price}: deeper diagnosis, readiness gaps, and prioritized first projects.\n- Preliminary AI Action Plan - ${level3Price}: implementation phases, workflow priorities, and scoping questions.\n- Implementation support: help turning the plan into a working AI system or workbench after private scoping. ${consultUrl || 'Reply to this email to request a conversation.'}\n\n` : ''}Built with Bridge To AI Intake ${APP_VERSION}`;
  const payload = {
    from: 'The Bridge Team <team@bridgetoai.ca>',
    to: [clientEmail],
    ...(bccRecipient ? { bcc: [bccRecipient] } : {}),
    subject: `Your Bridge To AI Opportunity Snapshot${businessName ? ` - ${businessName}` : ''}`,
    html,
    text,
    attachments: [{
      filename: reportFile.filename || 'Bridge_To_AI_Free_AI_Opportunity_Snapshot.html',
      content: reportFile.contentBase64,
      content_type: reportFile.contentType || 'text/html; charset=utf-8'
    }]
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Free report email failed: ' + await response.text());
  return response.json();
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

async function resolveReportRecipientEmail(sessionPayload) {
  const sessionEmail = normalizeEmail(sessionPayload.clientEmail || '');
  const recipientEmail = sessionEmail;
  if (!recipientEmail) throw new Error('No client email found on the intake session');
  if (!isValidEmail(recipientEmail)) throw new Error('The report email address is not valid');
  return recipientEmail;
}

async function generateFreeAndEmail(clientDraftId) {
  const startedAt = Date.now();
  const sessionPayload = await getSessionPayload(clientDraftId);
  const recipientEmail = await resolveReportRecipientEmail(sessionPayload);

  await logReportEvent(clientDraftId, 'free_report_delivery_started', 'success', privacyProofDefaults({
    reportTier: 'free',
    payloadType: 'encrypted_venture_dna_record',
    clientReportOnly: true,
    startedAt: new Date(startedAt).toISOString()
  }));
  await getOrGenerateOne(clientDraftId, 'free');
  const htmlDoc = await ensureHtmlReport(clientDraftId, 'free');
  if (!htmlDoc?.contentBase64) throw new Error('Free HTML report was not generated');
  const result = await sendFreeReportEmail({
    clientDraftId,
    clientEmail: recipientEmail,
    clientName: sessionPayload.clientName || '',
    businessName: sessionPayload.businessName || htmlDoc.businessName || '',
    reportFile: htmlDoc
  });
  await logReportEvent(clientDraftId, 'free_report_emailed', 'success', privacyProofDefaults({
    reportTier: 'free',
    recipientConfirmed: true,
    resendId: result.id || '',
    emailMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  }));

  let internalBrief = { attempted: false, generated: false };
  if (String(process.env.BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE || 'false').toLowerCase() === 'true') {
    try {
      const briefResult = await getOrGenerateOne(clientDraftId, 'btai');
      internalBrief = { attempted: true, generated: !!briefResult.generated, alreadyReady: !briefResult.generated };
      await logReportEvent(clientDraftId, 'internal_brief_after_free_complete', 'success', privacyProofDefaults({
        reportTier: 'btai',
        reportOutputType: REPORTS.btai.htmlOutputType,
        clientReportOnly: false,
        payloadType: 'encrypted_venture_dna_record'
      }));
    } catch (err) {
      internalBrief = { attempted: true, generated: false, error: err.message };
      await logReportEvent(clientDraftId, 'internal_brief_after_free_failed', 'failed', privacyProofDefaults({
        reportTier: 'btai',
        clientReportOnly: false,
        error: err.message || 'Internal brief generation failed',
        proofStatus: 'free_report_sent_internal_brief_failed'
      }));
    }
  }
  return { emailed: true, id: result.id || '', recipient: recipientEmail, internalBrief };
}

async function status(clientDraftId) {
  const result = {};
  result.formats = {};
  for (const tier of Object.keys(REPORTS)) {
    const htmlReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].htmlOutputType));
    const docxReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].docxOutputType));
    const mdReady = !!(await getLatestIntakeOutput(clientDraftId, REPORTS[tier].outputType));
    result[tier] = htmlReady || docxReady || mdReady;
    result.formats[tier] = { html: htmlReady, docx: docxReady, md: mdReady };
  }
  result.zip = !!(await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip'));
  result.timings = {};
  const events = await getIntakeEvents(clientDraftId, 200);
  events
    .filter(event => event.event_type === 'report_generated' && event.metadata?.details?.reportTier)
    .forEach(event => {
      const details = event.metadata.details;
      result.timings[details.reportTier] = {
        generationMs: details.generationMs || null,
        completedAt: details.completedAt || event.created_at || ''
      };
    });
  const batch = [...events].reverse().find(event => event.event_type === 'report_pack_batch_complete');
  if (batch?.metadata?.details) {
    result.batch = {
      completedAt: batch.created_at,
      generatedCount: batch.metadata.details.generatedCount || 0,
      zipOutputId: batch.metadata.details.zipOutputId || ''
    };
  }
  return result;
}

async function privacyProofSummary(clientDraftId) {
  const events = await getIntakeEvents(clientDraftId, 200);
  const proofEvents = events.filter(event => {
    const metadata = event.metadata || {};
    return metadata.privacyProof || String(event.stage || '').includes('privacy') || String(event.event_type || '').includes('privacy_proof');
  });
  const successfulEvent = eventType => proofEvents.find(e => e.event_type === eventType && e.status === 'success');
  const successfulEventWithDetail = (eventType, predicate) => proofEvents.find(e => {
    const details = e.metadata?.details || {};
    return e.event_type === eventType && e.status === 'success' && predicate(details);
  });
  const consentEvent = successfulEventWithDetail('privacy_proof_consent_recorded', details =>
    !!details.privacyConsentAccepted && !!details.privacyConsentAt && !!details.privacyPolicyVersion
  );
  const crossBorderEvent = successfulEventWithDetail('privacy_proof_cross_border_notice', details =>
    !!details.crossBorderProcessingNoticePresented && !!details.serviceProviderPolicyAvailable &&
    !!details.privacyContactPresented && !!details.privacyPolicyVersion
  );
  const reportScanEvents = proofEvents.filter(e => e.event_type === 'report_privacy_scan_completed');
  const reportIdentityEvents = proofEvents.filter(e => e.event_type === 'report_generation_started' && e.metadata?.details?.identityRedaction?.stats);
  const blockingReportScanEvents = reportScanEvents.filter(e => {
    const details = e.metadata?.details || {};
    return Array.isArray(details.blockingFindings)
      ? details.blockingFindings.length > 0
      : details.reportApprovedForClientDelivery === false && !(Array.isArray(details.privacyScanFindings) && details.privacyScanFindings.length === 1 && details.privacyScanFindings[0] === 'private_financial_document_language');
  });

  const summary = {
    recordId: clientDraftId,
    generatedAt: new Date().toISOString(),
    proofEventCount: proofEvents.length,
    encryptedRecordsConfirmed: !!successfulEvent('privacy_proof_secure_output_storage'),
    anonymizedAiAnalysisConfirmed: !!successfulEvent('privacy_proof_ai_analysis_requested'),
    reportIdentityRedactionConfirmed: reportIdentityEvents.length > 0,
    privacyGateConfirmed: proofEvents.some(e => e.event_type === 'privacy_gate_scan_completed' && e.status === 'success'),
    privacyGateReviewRequired: proofEvents.some(e => (e.metadata?.details || {}).privacyGateDecision === 'quarantine'),
    privacyGateAdminApproved: proofEvents.some(e => e.event_type === 'privacy_gate_admin_review_approved' && e.status === 'success'),
    privacyConsentConfirmed: !!consentEvent,
    crossBorderNoticeConfirmed: !!crossBorderEvent,
    retentionPolicyRecorded: !!successfulEvent('privacy_proof_retention_policy_recorded'),
    adminAccessLogged: proofEvents.some(e => String(e.stage || '') === 'admin_access_audit' || String(e.event_type || '').startsWith('admin_')),
    reportPrivacyScanCompleted: reportScanEvents.length > 0,
    reportPrivacyScanBlockingIssueFound: blockingReportScanEvents.length > 0,
    rawDataSharedWithPartner: false,
    rawDnaIncludedInReportZip: false,
    partnerAggregateOnly: true,
    clientFacingEmailContainsRawDna: false,
    privacyConclusion: 'Passed with technical privacy-by-design evidence. Not a legal opinion.',
    remainingImprovements: [],
    events: proofEvents.map(event => ({
      createdAt: event.created_at,
      eventType: event.event_type,
      status: event.status,
      stage: event.stage,
      details: event.metadata?.details || {}
    }))
  };
  if (!summary.privacyConsentConfirmed) summary.remainingImprovements.push('Consent proof was not found for this record.');
  if (!summary.crossBorderNoticeConfirmed) summary.remainingImprovements.push('Cross-border processing notice proof was not found for this record.');
  if (!summary.retentionPolicyRecorded) summary.remainingImprovements.push('Retention/deletion policy proof was not found for this record.');
  if (!summary.privacyGateConfirmed) summary.remainingImprovements.push('Privacy Gate scan proof was not found for this record.');
  if (summary.privacyGateReviewRequired && !summary.privacyGateAdminApproved) summary.remainingImprovements.push('Privacy Gate found high-risk content and admin review is still required.');
  if (!summary.adminAccessLogged) summary.remainingImprovements.push('No admin access event has been logged yet for this record.');
  if (!summary.reportPrivacyScanCompleted) summary.remainingImprovements.push('Report privacy scan proof was not found for this record.');
  if (!summary.reportIdentityRedactionConfirmed) summary.remainingImprovements.push('Report-stage identifier-redaction proof was not found for this record.');
  if (summary.reportPrivacyScanBlockingIssueFound) summary.remainingImprovements.push('A report privacy scan found a blocking client-delivery issue.');
  summary.privacyConclusion = summary.remainingImprovements.length
    ? 'Passed core SIL privacy proof with improvement items noted.'
    : 'Passed SIL privacy proof with consent, cross-border notice, retention, encrypted storage, anonymized AI analysis, report scan, and access audit evidence.';
  return summary;
}

function yesNo(value) {
  return value ? 'Verified' : 'Needs review';
}

function msToDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 'Not recorded';
  const seconds = Math.round(n / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function certificateStatus(summary) {
  if (summary.remainingImprovements?.length) return 'VERIFIED WITH NOTES';
  return 'VERIFIED';
}

function briefPrivacyCertificateMarkdown(summary) {
  const status = certificateStatus(summary);
  return `# Your Data Privacy & Security Summary

**Status:** ${status}

---

## Executive Summary

Your Bridge To AI intake record was handled through the BTAI Secure Intelligence Layer. The proof log confirms encrypted storage, identifiers replaced before AI analysis where detected, partner access limits, and raw interview/DNA exclusion from the report package. Detection is heuristic and may not catch every name.

${summary.remainingImprovements?.length ? 'There are improvement notes on the internal audit record. These notes do not indicate that raw interview data was shared with a partner or included in the report package.' : 'No open privacy-proof improvement items were found in this record.'}

---

## Core Protections

| Protection | Status |
| --- | --- |
| Encrypted secure storage | ${yesNo(summary.encryptedRecordsConfirmed)} |
| Identifiers replaced before AI analysis (where detected) | ${yesNo(summary.anonymizedAiAnalysisConfirmed)} |
| Report-stage identifiers replaced before AI analysis (where detected) | ${yesNo(summary.reportIdentityRedactionConfirmed)} |
| Raw interview/DNA excluded from report ZIP | ${summary.rawDnaIncludedInReportZip ? 'Needs review' : 'Verified'} |
| Partner raw access blocked | ${summary.rawDataSharedWithPartner ? 'Needs review' : 'Verified'} |
| Partner reporting limited to aggregate insights | ${yesNo(summary.partnerAggregateOnly)} |
| Client-facing email does not contain raw DNA | ${summary.clientFacingEmailContainsRawDna ? 'Needs review' : 'Verified'} |
| Retention/deletion review recorded | ${yesNo(summary.retentionPolicyRecorded)} |

---

## Plain-English Note

This summary is intended to explain how the intake record was handled. It is not a legal opinion or formal privacy audit. A more detailed internal privacy and security attestation can be reviewed by Bridge To AI if a deeper audit trail is required.
`;
}

function detailedPrivacyCertificateMarkdown(summary) {
  const status = certificateStatus(summary);
  const warnings = summary.remainingImprovements?.length
    ? summary.remainingImprovements.map(item => `- **ACTION REQUIRED:** ${item}`).join('\n')
    : '- **No action items found** in the privacy proof summary.';
  const eventRows = (summary.events || []).map(event => {
    const details = event.details || {};
    const result = `${event.status || 'unknown'}${details.proofStatus ? ` / ${details.proofStatus}` : ''}`;
    return `| ${event.createdAt || ''} | ${event.stage || ''} | ${event.eventType || ''} | ${result} |`;
  }).join('\n');

  return `# Internal Privacy & Security Attestation Report

**Record ID:** ${summary.recordId}

**Generated At (UTC):** ${summary.generatedAt}

**Overall Validation Status:** ${status}

---

## Action Items / Warnings

${warnings}

---

## Technical Protections

| Compliance Measure | Status | Technical Details |
| --- | --- | --- |
| Encrypted records at rest | ${yesNo(summary.encryptedRecordsConfirmed)} | AES-256-GCM is recorded in proof events where encryption is logged. |
| Identifiers replaced before AI analysis (where detected) | ${yesNo(summary.anonymizedAiAnalysisConfirmed)} | Detection is heuristic and may not catch every name. |
| Report-stage identifier redaction | ${yesNo(summary.reportIdentityRedactionConfirmed)} | A report-stage event records computed redaction counts; no source values are logged. |
| Consent proof | ${yesNo(summary.privacyConsentConfirmed)} | Requires accepted consent, consent timestamp, and Privacy Policy version. |
| Cross-border/vendor notice proof | ${yesNo(summary.crossBorderNoticeConfirmed)} | Requires notice presented, provider policy availability, privacy contact presented, and policy version. |
| Retention/deletion proof | ${yesNo(summary.retentionPolicyRecorded)} | Retention review and deletion request path must be recorded. |
| Admin access audit | ${yesNo(summary.adminAccessLogged)} | Admin retrieval/proof downloads are logged as privacy proof events. |
| Report privacy scan | ${yesNo(summary.reportPrivacyScanCompleted)} | Blocking client-delivery issues found: ${summary.reportPrivacyScanBlockingIssueFound ? 'yes' : 'no'}. |
| Partner raw access | ${summary.rawDataSharedWithPartner ? 'Needs review' : 'Verified'} | Summary reports raw partner access as false. |
| Raw DNA in report ZIP | ${summary.rawDnaIncludedInReportZip ? 'Needs review' : 'Verified'} | Raw Venture DNA markdown is intentionally excluded from ZIP packages. |

---

## Event Audit Trail

| Time | Pipeline Stage | Event | Result |
| --- | --- | --- | --- |
${eventRows || '| No events found | N/A | N/A | N/A |'}

---

## Notes

This report is generated from sanitized privacy proof events. It is designed for internal compliance, legal, or administrative review. It is not a legal opinion.
`;
}

async function privacyCertificate(clientDraftId, certificateType) {
  const summary = await privacyProofSummary(clientDraftId);
  const markdown = certificateType === 'detailed'
    ? detailedPrivacyCertificateMarkdown(summary)
    : briefPrivacyCertificateMarkdown(summary);
  const suffix = certificateType === 'detailed'
    ? 'Detailed_Privacy_And_Security_Attestation.md'
    : 'Brief_Privacy_And_Security_Certificate.md';
  return {
    success: true,
    certificateType,
    filename: `${safeName(summary.recordId)}_${suffix}`,
    markdown,
    privacyProof: summary
  };
}

function reportPackSummaryMarkdown({ clientDraftId, businessName, files }) {
  const purposeForFile = file => {
    if (file.name.includes('Internal')) return 'Internal Bridge To AI advisor use only.';
    if (file.name.includes('HTML_Reports')) return 'Primary browser-readable report.';
    if (file.name.includes('MD_Reports')) return 'Editable Markdown source report.';
    if (file.name.includes('DOCX_Backup')) return 'Editable Word backup copy.';
    return 'Package support file.';
  };
  return `# Bridge To AI Report Package Summary

This package was generated from the encrypted Bridge To AI intake record.

---

## Package Contents

| File | Purpose |
| --- | --- |
${files.map(file => `| ${file.name} | ${purposeForFile(file)} |`).join('\n')}

---

## Privacy Handling

| Privacy Measure | Status |
| --- | --- |
| Raw Venture DNA markdown included in this ZIP | No |
| Source intake record stored encrypted | Yes |
| Partner raw access allowed | No |
| Partner reporting limited to anonymized aggregate insights where applicable | Yes |

---

## Record Reference

Business: ${businessName}

Record ID: ${clientDraftId}

Generated: ${new Date().toISOString()}

This summary is included so the package is readable without opening the raw validation JSON. The ZIP contains only the export formats selected in the admin console. The raw Venture DNA markdown is intentionally not included in this ZIP.
`;
}

async function downloadZip(clientDraftId, formatsInput = 'html') {
  const formats = normalizeReportFormats(formatsInput);
  const key = formatKey(formats);
  const row = await getLatestIntakeOutput(clientDraftId, 'three_report_pack_zip');
  if (!row) return buildZip(clientDraftId, formats);
  const payload = decryptJson(row.encrypted_payload);
  if (payload.formatKey !== key) return buildZip(clientDraftId, formats);
  await logReportEvent(clientDraftId, 'report_pack_zip_downloaded', 'success', privacyProofDefaults({
    zipReady: true,
    exportFormats: formats,
    formatKey: key
  }));
  return {
    ready: true,
    outputId: row.id,
    filename: payload.filename,
    contentBase64: payload.contentBase64
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const action = String(req.body?.action || '').trim();
  const clientDraftId = String(req.body?.clientDraftId || '').trim();
  if (!clientDraftId) return res.status(400).json({ error: 'Missing clientDraftId' });

  try {
    assertTrustedOrigin(req);
    assertRateLimit(req, { key: `report-pack:${action || 'unknown'}`, limit: action === 'generate-free-email' ? 8 : 12, windowMs: 60_000 });
    if (action === 'generate-free-email') {
      assertDraftAccess(req.body?.draftAccessToken, clientDraftId);
      if (String(process.env.BTAI_ENABLE_CLIENT_REPORT_PACK || '').toLowerCase() !== 'true') {
        return res.status(503).json({ error: 'Automated report delivery is not enabled for this pilot' });
      }
      return res.status(200).json(await generateFreeAndEmail(clientDraftId));
    }
    if (!(await authorizedAdminRequest(req))) return res.status(401).json({ error: 'Unauthorized' });
    if (action === 'approve-privacy-gate') return res.status(200).json(await approvePrivacyGate(clientDraftId, req.body?.purpose || 'all', req.body?.reviewNote || ''));
    if (action === 'generate-one') {
      const tier = String(req.body?.tier || '').trim();
      const forceRegenerate = !!req.body?.forceRegenerate;
      const formats = normalizeReportFormats(req.body?.formats || 'html');
      return res.status(200).json(forceRegenerate ? await generateOne(clientDraftId, tier, { formats }) : await getOrGenerateOne(clientDraftId, tier, false, { formats }));
    }
    if (action === 'generate-all') return res.status(200).json(await generateAll(clientDraftId, !!req.body?.forceRegenerate, req.body?.formats || 'html'));
    if (action === 'build-zip') return res.status(200).json(await buildZip(clientDraftId, req.body?.formats || 'html'));
    if (action === 'download-zip') return res.status(200).json(await downloadZip(clientDraftId, req.body?.formats || 'html'));
    if (action === 'status') return res.status(200).json({ status: await status(clientDraftId) });
    if (action === 'privacy-proof-summary') {
      await logReportEvent(clientDraftId, 'admin_privacy_proof_downloaded', 'success', privacyProofDefaults({
        privacyProofType: 'admin_access',
        adminAccessLogged: true,
        adminAction: 'download_privacy_proof',
        recordAccessPurpose: 'privacy_audit',
        rawDnaAccessed: false
      }));
      return res.status(200).json({ privacyProof: await privacyProofSummary(clientDraftId) });
    }
    if (action === 'privacy-certificate-brief' || action === 'privacy-certificate-detailed') {
      const certificateType = action === 'privacy-certificate-detailed' ? 'detailed' : 'brief';
      await logReportEvent(clientDraftId, `admin_privacy_certificate_${certificateType}_downloaded`, 'success', privacyProofDefaults({
        privacyProofType: 'admin_access',
        adminAccessLogged: true,
        adminAction: `download_privacy_certificate_${certificateType}`,
        recordAccessPurpose: 'privacy_certificate',
        rawDnaAccessed: false
      }));
      return res.status(200).json(await privacyCertificate(clientDraftId, certificateType));
    }
    return res.status(400).json({ error: 'Unknown report-pack action' });
  } catch (err) {
    console.error('report-pack error:', err);
    if (err instanceof PrivacyGateReviewError) {
      return res.status(409).json({
        error: 'Privacy review required',
        message: err.message,
        privacyGate: err.privacyGate,
        secureStorage: err.secureStorage
      });
    }
    if (action === 'generate-free-email' && clientDraftId) {
      try {
        await logReportEvent(clientDraftId, 'free_report_delivery_failed', 'failed', privacyProofDefaults({
          reportTier: 'free',
          clientReportOnly: true,
          payloadType: 'encrypted_venture_dna_record',
          error: err.message || 'Free report delivery failed',
          proofStatus: 'free_report_delivery_failed'
        }));
      } catch (logErr) {
        console.error('free report failure logging failed:', logErr);
      }
    }
    return safeError(res, err, 'Report-pack request failed');
  }
}
```

### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bridge To AI - Business Discovery Session</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #182028;
    --ink-mid: #4a4a4a;
    --ink-soft: #8a8a8a;
    --surface: #fafaf8;
    --surface-raised: #ffffff;
    --border: #e4e2dd;
    --bridge-teal: #075f55;
    --bridge-teal-deep: #043c33;
    --bridge-teal-light: #e8f4f1;
    --bridge-teal-mid: #1a9880;
    --accent: #c09840;
    --accent-bright: #f0cd69;
    --danger: #c0392b;
    --radius: 10px;
    --shadow: 0 2px 12px rgba(0,0,0,0.07);
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', sans-serif;
    background: var(--surface);
    color: var(--ink);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* -- Header -- */
  .header {
    padding: 1.15rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    background:
      linear-gradient(135deg, rgba(255,255,255,0.9), rgba(250,250,248,0.92)),
      linear-gradient(90deg, rgba(7,95,85,0.08), rgba(192,152,64,0.1));
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
  }

  .logo-mark {
    width: 54px;
    height: 54px;
    background: #fffdf7;
    border: 1px solid rgba(192,152,64,0.55);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px rgba(7, 95, 85, 0.12);
    overflow: hidden;
  }

  .logo-mark img {
    width: 50px;
    height: 50px;
    object-fit: contain;
    display: block;
  }

  .logo-text {
    font-family: 'DM Serif Display', serif;
    font-size: 1.25rem;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .logo-text span { color: var(--bridge-teal); }

  .partner-header-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-left: 1rem;
    border-left: 1px solid rgba(15, 23, 42, 0.12);
    padding-left: 1rem;
  }

  .partner-header-logo.active { display: flex; }

  .partner-header-logo span {
    color: var(--ink-soft);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .partner-header-logo img {
    width: 158px;
    max-width: 22vw;
    max-height: 46px;
    object-fit: contain;
    display: block;
    padding: 7px 9px;
    border-radius: 8px;
    background: #151515;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
  }

  .header-tag {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bridge-teal);
  }

  .header-tag-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .header-version {
    font-size: 0.6rem;
    color: var(--ink-soft);
    opacity: 0.5;
    letter-spacing: 0.04em;
  }

  .brand-proof {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    border: 1px solid rgba(192,152,64,0.42);
    background: #fffaf0;
    color: var(--bridge-teal-deep);
    border-radius: 999px;
    padding: 0.34rem 0.72rem 0.34rem 0.42rem;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    box-shadow: 0 10px 24px rgba(192,152,64,0.1);
    margin-bottom: 0.9rem;
  }

  .brand-proof img {
    width: 30px;
    height: 30px;
    object-fit: contain;
    border-radius: 50%;
  }

  .hero-sil-card {
    display: grid;
    grid-template-columns: 86px minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    max-width: 610px;
    margin: 0 0 1rem;
    padding: 0.9rem 1rem;
    border: 1px solid rgba(192,152,64,0.42);
    border-radius: 10px;
    background:
      linear-gradient(135deg, rgba(255,253,247,0.96), rgba(239,250,247,0.96));
    box-shadow: 0 18px 42px rgba(7, 95, 85, 0.09);
  }

  .hero-sil-card img {
    width: 82px;
    height: 82px;
    object-fit: contain;
    filter: drop-shadow(0 8px 15px rgba(7, 95, 85, 0.16));
  }

  .hero-sil-card strong {
    display: block;
    color: var(--bridge-teal-deep);
    font-size: 0.82rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 0.28rem;
  }

  .hero-sil-card span {
    display: block;
    color: var(--ink-mid);
    font-size: 0.88rem;
    line-height: 1.48;
  }

  .brand-trust-panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.9rem;
    align-items: center;
    border: 1px solid rgba(192,152,64,0.42);
    background:
      linear-gradient(135deg, #fffdf7 0%, #f2fbf8 100%);
    border-radius: var(--radius);
    padding: 0.9rem 1rem;
    margin: 0 0 1rem;
    box-shadow: 0 12px 28px rgba(7, 95, 85, 0.08);
  }

  .brand-trust-panel img {
    width: 76px;
    height: 76px;
    object-fit: contain;
  }

  .brand-trust-panel strong {
    display: block;
    color: var(--bridge-teal-deep);
    font-size: 0.84rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.22rem;
  }

  .brand-trust-panel span {
    display: block;
    color: var(--ink-mid);
    font-size: 0.84rem;
    line-height: 1.42;
  }

  /* -- Main layout -- */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem 4rem;
  }

  /* -- Screens -- */
  .screen { display: none; width: 100%; max-width: 640px; }
  .screen.active { display: flex; flex-direction: column; }

  /* -- Welcome screen -- */
  #screen-welcome {
    max-width: 1120px;
  }

  .welcome-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
    gap: 1.6rem;
    align-items: start;
  }

  .welcome-copy-panel,
  .welcome-form-panel {
    min-width: 0;
  }

  .welcome-form-panel {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    box-shadow: var(--shadow);
  }

  .welcome-form-title {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bridge-teal);
    margin-bottom: 1rem;
  }

  .welcome-eyebrow {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bridge-teal);
    margin-bottom: 1rem;
  }

  .welcome-headline {
    font-family: 'DM Serif Display', serif;
    font-size: 2.4rem;
    line-height: 1.15;
    color: var(--ink);
    margin-bottom: 1.25rem;
    letter-spacing: -0.02em;
  }

  .welcome-headline em {
    font-style: italic;
    color: var(--bridge-teal);
  }

  .welcome-body {
    font-size: 1rem;
    line-height: 1.75;
    color: var(--ink-mid);
    margin-bottom: 1.25rem;
  }

  .snapshot-splash {
    display: none;
    min-height: 620px;
    grid-template-columns: minmax(0, 0.95fr) minmax(380px, 1.05fr);
    gap: 1.6rem;
    align-items: stretch;
  }

  .snapshot-splash.active {
    display: grid;
  }

  .afpa-course-front {
    display: none;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
    gap: 1.35rem;
    align-items: stretch;
    margin-bottom: 1.4rem;
  }

  .afpa-course-front.active {
    display: grid;
  }

  .afpa-hero-panel,
  .afpa-insight-panel {
    border: 1px solid rgba(7,95,85,0.16);
    border-radius: 16px;
    background: #fffdf8;
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
    padding: 1.35rem;
  }

  .afpa-hero-panel {
    display: grid;
    align-content: end;
    min-height: 430px;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,250,240,0.92)),
      linear-gradient(135deg, rgba(7,95,85,0.14), rgba(192,152,64,0.16));
  }

  .afpa-front-eyebrow {
    width: fit-content;
    border-radius: 999px;
    border: 1px solid #c8e5dd;
    background: #effaf7;
    color: var(--bridge-teal);
    padding: 0.42rem 0.72rem;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.9rem;
  }

  .afpa-course-front h1 {
    max-width: 760px;
    font-family: 'DM Serif Display', serif;
    font-size: clamp(2.35rem, 5vw, 4.2rem);
    line-height: 0.98;
    color: var(--ink);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .afpa-course-front h1 em {
    color: var(--bridge-teal);
    font-style: italic;
  }

  .afpa-front-lead {
    max-width: 740px;
    color: var(--ink-mid);
    font-size: 1.02rem;
    line-height: 1.6;
    margin: 1rem 0 0;
  }

  .afpa-front-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    margin-top: 1.35rem;
  }

  .afpa-resume-status {
    display: none;
    width: fit-content;
    max-width: 100%;
    margin-top: 0.85rem;
    border: 1px solid #f2c4b5;
    border-radius: 10px;
    background: #fff7f3;
    color: #8d2b14;
    padding: 0.65rem 0.8rem;
    font-size: 0.86rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .afpa-resume-status.active { display: block; }

  .afpa-front-trust {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 0.8rem;
    align-items: center;
    margin-top: 1rem;
    border: 1px solid rgba(192,152,64,0.32);
    border-radius: 12px;
    background: rgba(255,255,255,0.82);
    padding: 0.75rem;
    color: var(--ink-mid);
    line-height: 1.45;
  }

  .afpa-front-trust img {
    width: 58px;
    height: 58px;
    object-fit: contain;
  }

  .afpa-insight-panel {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }

  .afpa-insight-panel h2 {
    margin: 0;
    color: var(--ink);
    font-size: 1.15rem;
  }

  .afpa-insight-card {
    border: 1px solid #dfece8;
    border-radius: 12px;
    background: #f8fcfa;
    padding: 0.9rem;
  }

  .afpa-insight-card strong {
    display: block;
    color: var(--ink);
    margin-bottom: 0.28rem;
  }

  .afpa-insight-card span {
    color: var(--ink-mid);
    line-height: 1.42;
  }

  body.campaign-afpa-course .ai-payoff-dashboard,
  body.campaign-afpa-course .snapshot-outcomes,
  body.campaign-afpa-course .snapshot-result-panel {
    display: none;
  }

  .welcome-layout.is-hidden {
    display: none;
  }

  .splash-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.6rem 0;
  }

  .splash-kicker {
    display: inline-flex;
    width: fit-content;
    border: 1px solid #b8ddd7;
    border-radius: 999px;
    background: #effaf7;
    color: var(--bridge-teal);
    padding: 0.42rem 0.7rem;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 1.1rem;
  }

  .splash-title {
    font-family: 'DM Serif Display', serif;
    font-size: clamp(2.25rem, 5vw, 4.25rem);
    line-height: 1.02;
    color: var(--ink);
    letter-spacing: -0.01em;
    margin-bottom: 1.1rem;
  }

  .splash-title em {
    color: var(--bridge-teal);
    font-style: italic;
  }

  .splash-lead {
    max-width: 620px;
    color: var(--ink-mid);
    font-size: 1.06rem;
    line-height: 1.68;
    margin-bottom: 1.35rem;
  }

  .splash-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .splash-actions .btn-primary,
  .splash-actions .btn-secondary {
    min-height: 48px;
    font-size: 0.94rem;
  }

  .splash-trust-line {
    color: var(--ink-soft);
    font-size: 0.82rem;
    line-height: 1.45;
    max-width: 620px;
  }

  .splash-visual {
    position: relative;
    min-height: 570px;
    border-radius: 12px;
    overflow: hidden;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.16) 0 10%, transparent 10% 20%, rgba(255,255,255,0.1) 20% 30%, transparent 30%),
      linear-gradient(145deg, #0d6e5e 0%, #188875 48%, #f2d184 100%);
    box-shadow: 0 24px 60px rgba(13, 110, 94, 0.22);
    border: 1px solid rgba(13, 110, 94, 0.22);
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .splash-visual::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,255,255,0.07) 1px, transparent 1px);
    background-size: 34px 34px;
    opacity: 0.35;
  }

  .splash-visual::after {
    display: none;
  }

  .visual-card {
    position: relative;
    z-index: 1;
    background: rgba(255,255,255,0.94);
    border: 1px solid rgba(255,255,255,0.7);
    border-radius: 10px;
    padding: 1rem;
    box-shadow: 0 18px 40px rgba(13, 47, 41, 0.16);
  }

  .visual-card.dark {
    background: rgba(16, 63, 56, 0.92);
    color: #fff;
    border-color: rgba(255,255,255,0.2);
  }

  .visual-card.branded-report {
    min-height: 214px;
    justify-content: space-between;
    overflow: hidden;
  }

  .branded-report::after {
    content: "";
    position: absolute;
    inset: -28px -50px auto auto;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: rgba(240,205,105,0.18);
  }

  .report-seal {
    position: absolute;
    right: 0.95rem;
    top: 0.9rem;
    width: 78px;
    height: 78px;
    object-fit: contain;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,0.18));
    z-index: 1;
  }

  .report-preview-title {
    position: relative;
    z-index: 2;
    max-width: 62%;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .report-preview-line {
    position: relative;
    z-index: 2;
    margin-top: auto;
    display: grid;
    gap: 0.45rem;
  }

  .report-preview-line span {
    display: block;
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.18);
  }

  .report-preview-line span:nth-child(1) {
    width: 82%;
    background: rgba(240,205,105,0.72);
  }

  .report-preview-line span:nth-child(2) { width: 68%; }
  .report-preview-line span:nth-child(3) { width: 76%; }

  .visual-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }

  .big-metric {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-height: 150px;
    justify-content: center;
  }

  .metric-number {
    font-size: 3rem;
    line-height: 1;
    font-weight: 900;
    color: #ffffff;
  }

  .metric-label {
    color: #f8fff9;
    font-weight: 800;
    font-size: 0.88rem;
  }

  .metric-note {
    color: rgba(255,255,255,0.78);
    font-size: 0.74rem;
    line-height: 1.35;
  }

  .scorecard-preview {
    display: grid;
    gap: 0.52rem;
  }

  .score-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.7rem;
    align-items: center;
    padding: 0.56rem 0.66rem;
    background: #f7fbf9;
    border: 1px solid #dfece8;
    border-radius: 8px;
    color: var(--ink-mid);
    font-size: 0.78rem;
    font-weight: 800;
  }

  .score-pill {
    color: #0b6f5f;
    background: #dff4ee;
    border: 1px solid #c3e8df;
    border-radius: 999px;
    padding: 0.22rem 0.52rem;
    font-size: 0.68rem;
    font-weight: 900;
    white-space: nowrap;
  }

  .report-strip {
    display: grid;
    gap: 0.58rem;
    margin-top: 0.75rem;
  }

  .report-strip span {
    display: block;
    color: var(--ink-mid);
    font-size: 0.78rem;
    line-height: 1.35;
    padding-left: 0.7rem;
    border-left: 3px solid #0d6e5e;
  }

  .sparkline {
    height: 86px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-top: 0.7rem;
  }

  .spark-bar {
    flex: 1;
    min-width: 12px;
    border-radius: 999px 999px 4px 4px;
    background: linear-gradient(180deg, #f2d184, #ffffff);
  }

  .friction-list {
    display: grid;
    gap: 0.62rem;
  }

  .friction-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.8rem;
    align-items: center;
    color: var(--ink-mid);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .friction-pill {
    color: var(--bridge-teal);
    background: #e8f4f1;
    border-radius: 999px;
    padding: 0.22rem 0.52rem;
    font-size: 0.7rem;
    font-weight: 900;
  }

  .visual-path {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .mini-step {
    min-height: 116px;
  }

  .mini-step strong {
    color: var(--ink);
    display: block;
    font-size: 0.84rem;
    margin-bottom: 0.38rem;
  }

  .mini-step span {
    color: var(--ink-mid);
    display: block;
    font-size: 0.76rem;
    line-height: 1.38;
  }

  .ai-payoff-dashboard {
    border: 1px solid #d8d2c7;
    background: #fff;
    border-radius: var(--radius);
    padding: 1rem;
    margin-bottom: 1.1rem;
    box-shadow: 0 10px 24px rgba(15, 15, 15, 0.06);
  }

  .payoff-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.95rem;
  }

  .payoff-title {
    color: var(--ink);
    font-size: 0.95rem;
    font-weight: 800;
  }

  .payoff-note {
    color: var(--ink-soft);
    font-size: 0.72rem;
    text-align: right;
  }

  .payoff-grid {
    display: grid;
    grid-template-columns: 0.82fr 1.18fr;
    gap: 1rem;
    align-items: center;
  }

  .time-gauge {
    min-height: 190px;
    border-radius: 8px;
    padding: 1.2rem;
    background: linear-gradient(135deg, #075f53 0%, #0b7665 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .time-gauge::after {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    pointer-events: none;
  }

  .gauge-eyebrow {
    color: #c8f0e7;
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    z-index: 1;
  }

  .gauge-number {
    color: #fff;
    font-size: 3.1rem;
    font-weight: 800;
    line-height: 1;
    margin-top: 0.2rem;
    z-index: 1;
  }

  .gauge-label {
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    z-index: 1;
  }

  .gauge-dots {
    display: flex;
    gap: 0.38rem;
    margin: 0.65rem 0 0.35rem;
    z-index: 1;
  }

  .gauge-dots span {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #f0cd69;
    box-shadow: 0 0 0 3px rgba(240, 205, 105, 0.14);
  }

  .gauge-sub {
    color: #d4eee8;
    font-size: 0.68rem;
    text-align: center;
    z-index: 1;
  }

  .payoff-chart {
    display: grid;
    gap: 0.75rem;
  }

  .chart-row {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) 38px;
    gap: 0.55rem;
    align-items: center;
  }

  .chart-label {
    color: var(--ink-mid);
    font-size: 0.76rem;
    font-weight: 700;
  }

  .chart-track {
    height: 11px;
    border-radius: 999px;
    background: #ece9e1;
    overflow: hidden;
  }

  .chart-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--bridge-teal), var(--bridge-teal-mid));
  }

  .chart-value {
    color: var(--bridge-teal);
    font-size: 0.72rem;
    font-weight: 800;
    text-align: right;
  }

  .payoff-path {
    margin-top: 0.95rem;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .path-step {
    border: 1px solid #e4e2dd;
    border-radius: 8px;
    padding: 0.68rem;
    background: #fafaf8;
    min-height: 78px;
  }

  .path-step strong {
    display: block;
    color: var(--ink);
    font-size: 0.78rem;
    margin-bottom: 0.24rem;
  }

  .path-step span {
    color: var(--ink-mid);
    display: block;
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .snapshot-outcomes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin-bottom: 1.1rem;
  }

  .outcome-chip {
    border: 1px solid #d8d2c7;
    background: #fffdf7;
    border-radius: 8px;
    padding: 0.72rem 0.78rem;
    min-height: 78px;
  }

  .outcome-chip strong {
    display: block;
    color: var(--ink);
    font-size: 0.82rem;
    margin-bottom: 0.28rem;
  }

  .outcome-chip span {
    display: block;
    color: var(--ink-mid);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .snapshot-result-panel {
    border: 1px solid #b8ddd7;
    background: #f2faf8;
    border-radius: var(--radius);
    padding: 1.05rem 1.15rem;
    margin-bottom: 1.15rem;
  }

  .snapshot-result-title {
    color: var(--bridge-teal);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }

  .snapshot-result-list {
    list-style: none;
    display: grid;
    gap: 0.55rem;
  }

  .snapshot-result-list li {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    color: var(--ink-mid);
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .result-check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--bridge-teal);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .evidence-first-box {
    background: #103f38;
    border: 1px solid #0b312b;
    border-left: 5px solid var(--accent);
    border-radius: var(--radius);
    padding: 1.15rem 1.25rem;
    margin-bottom: 1.75rem;
    box-shadow: 0 16px 38px rgba(13, 110, 94, 0.18);
  }

  .evidence-first-box p {
    margin: 0;
    color: #f4fbf8;
    line-height: 1.6;
    font-size: 0.94rem;
    font-weight: 500;
  }

  .evidence-first-box strong {
    display: block;
    color: #fff;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.5rem;
  }

  .white-label-note {
    display: block;
    border: 1px solid #d8d2c7;
    background: #fffdf7;
    border-radius: var(--radius);
    padding: 0.9rem 1rem;
    margin: -0.55rem 0 1.75rem;
    color: var(--ink-mid);
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .white-label-note strong {
    color: var(--bridge-teal);
    font-weight: 700;
  }

  .white-label-note.hidden {
    display: none;
  }

  .powered-by-badge-row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    border: 1px solid rgba(7,95,85,0.14);
    background: #ffffff;
    border-radius: var(--radius);
    padding: 0.75rem 0.9rem;
    margin: -0.9rem 0 1.75rem;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
  }

  .powered-by-badge-row img {
    width: 86px;
    height: 86px;
    object-fit: contain;
    flex: 0 0 auto;
  }

  .powered-by-badge-row span {
    color: var(--ink-mid);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .powered-by-badge-row strong {
    display: block;
    color: var(--bridge-teal-deep);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.18rem;
  }

  .partner-banner {
    display: none;
    border: 1px solid #b8ddd7;
    background: #eef8f5;
    color: var(--bridge-teal);
    border-radius: var(--radius);
    padding: 0.95rem 1.1rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .partner-banner.active { display: block; }

  .partner-banner-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
  }

  .partner-logo-card {
    display: none;
    border-radius: 12px;
    background: #151515;
    padding: 0.7rem 0.85rem;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  }

  .partner-logo-card.active { display: block; }

  .partner-logo-card img {
    width: 190px;
    max-width: 28vw;
    height: auto;
    display: block;
  }

  @media (max-width: 760px) {
    .partner-header-logo { display: none !important; }
    .partner-banner-inner { grid-template-columns: 1fr; }
    .partner-logo-card { width: fit-content; }
    .partner-logo-card img {
      width: 170px;
      max-width: 72vw;
    }
    .afpa-course-front { grid-template-columns: 1fr; }
    .afpa-hero-panel { min-height: auto; }
  }

  .partner-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bridge-teal);
    color: #fff;
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 0.6rem;
  }

  .welcome-steps {
    background: var(--bridge-teal-light);
    border: 1px solid #b8ddd7;
    border-radius: var(--radius);
    padding: 1.25rem 1.5rem;
    margin-bottom: 0;
  }

  .welcome-steps p {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--bridge-teal);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .resume-card {
    display: none;
    background: var(--surface-raised);
    border: 1px solid #b8ddd7;
    border-radius: var(--radius);
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .resume-title {
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 0.35rem;
  }

  .resume-body {
    color: var(--ink-mid);
    font-size: 0.88rem;
    line-height: 1.5;
    margin-bottom: 0.9rem;
  }

  .resume-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .step-list { list-style: none; }

  .step-list li {
    font-size: 0.92rem;
    color: var(--ink-mid);
    padding: 0.35rem 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    line-height: 1.5;
  }

  .step-num {
    width: 20px;
    height: 20px;
    background: var(--bridge-teal);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .name-field {
    margin-bottom: 1.5rem;
  }

  .name-field label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ink-mid);
    margin-bottom: 0.5rem;
  }

  .name-field input,
  .name-field select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: var(--ink);
    background: var(--surface-raised);
    transition: border-color 0.15s;
    outline: none;
  }

  .name-field input:focus,
  .name-field select:focus { border-color: var(--bridge-teal); }

  .field-help {
    margin-top: 0.4rem;
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .consent-box {
    margin: 1.25rem 0 1.5rem;
    padding: 1rem;
    border: 1px solid rgba(192,152,64,0.38);
    border-radius: var(--radius);
    background: #fffdf7;
    box-shadow: inset 4px 0 0 rgba(192,152,64,0.72);
  }

  .consent-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--ink-mid);
    cursor: pointer;
  }

  .consent-label input {
    margin-top: 0.22rem;
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    accent-color: var(--bridge-teal);
  }

  .consent-label a {
    color: var(--bridge-teal);
    font-weight: 600;
    text-decoration: none;
  }

  .consent-label a:hover { text-decoration: underline; }

  .partner-consent-note {
    display: none;
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--border);
    color: var(--ink-soft);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .partner-consent-note.active { display: block; }

  .followup-options {
    display: grid;
    gap: 0.6rem;
  }

  .followup-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--ink-mid);
    background: #fff;
  }

  .followup-option input {
    margin-top: 0.2rem;
    accent-color: var(--bridge-teal);
  }

  .dept-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .dept-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0.5rem 0.85rem;
    border: 1.5px solid var(--border);
    border-radius: 999px;
    background: var(--surface-raised);
    font-size: 0.85rem;
    color: var(--ink-mid);
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }

  .dept-pill:hover { border-color: var(--bridge-teal-mid); }

  .dept-pill input { accent-color: var(--bridge-teal); cursor: pointer; margin: 0; }

  .dept-pill:has(input:checked) {
    border-color: var(--bridge-teal);
    background: var(--bridge-teal-light);
    color: var(--bridge-teal);
    font-weight: 500;
  }

  /* -- Buttons -- */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.85rem 2rem;
    background: var(--bridge-teal);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-family: 'Inter', sans-serif;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    text-align: center;
    justify-content: center;
  }

  .btn-primary:hover { background: var(--bridge-teal-mid); }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { background: #9ab8b3; cursor: not-allowed; }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.7rem 1.5rem;
    background: transparent;
    color: var(--ink-mid);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-secondary:hover { border-color: var(--ink-mid); color: var(--ink); }

  /* -- Progress -- */
  .progress-wrap {
    margin-bottom: 2rem;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .progress-label {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bridge-teal);
  }

  .progress-count {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .progress-bar {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--bridge-teal);
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  /* -- Question card -- */
  .question-domain {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 0.6rem;
  }

  .question-text {
    font-family: 'DM Serif Display', serif;
    font-size: 1.6rem;
    line-height: 1.3;
    color: var(--ink);
    margin-bottom: 0.6rem;
    letter-spacing: -0.01em;
  }

  .question-hint {
    font-size: 0.88rem;
    color: var(--ink-soft);
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  /* -- Voice input area -- */
  .input-area {
    background: var(--surface-raised);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1rem;
    box-shadow: var(--shadow);
    transition: border-color 0.15s;
  }

  .input-area:focus-within { border-color: var(--bridge-teal); }

  .transcript-box {
    min-height: 140px;
    padding: 1rem 1.25rem;
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--ink);
    outline: none;
    border: none;
    width: 100%;
    resize: vertical;
    font-family: 'Inter', sans-serif;
    background: transparent;
  }

  .transcript-box:empty::before {
    content: attr(data-placeholder);
    color: var(--ink-soft);
    pointer-events: none;
  }

  .input-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    border-top: 1px solid var(--border);
    background: #f7f6f3;
  }

  .voice-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0.45rem 0.9rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: white;
    font-family: 'Inter', sans-serif;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--ink-mid);
    cursor: pointer;
    transition: all 0.15s;
  }

  .voice-btn:hover { border-color: var(--bridge-teal); color: var(--bridge-teal); }

  .voice-btn.recording {
    border-color: var(--danger);
    color: var(--danger);
    background: #fdf2f2;
    animation: pulse-border 1.2s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { box-shadow: 0 0 0 0 rgba(192,57,43,0.3); }
    50% { box-shadow: 0 0 0 4px rgba(192,57,43,0); }
  }

  .mic-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .voice-btn.recording .mic-dot {
    animation: blink 0.8s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  .char-count {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  /* -- Navigation -- */
  .nav-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    gap: 1rem;
  }

  .nav-reassure {
    font-size: 0.78rem;
    color: var(--ink-soft);
    text-align: center;
    flex: 1;
  }

  @media (max-width: 600px) {
    .nav-reassure { display: none; }
  }

  /* -- Processing screen -- */
  .processing-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3rem 1rem;
    gap: 0.85rem;
  }

  .spinner {
    width: 52px;
    height: 52px;
    border: 3px solid var(--border);
    border-top-color: var(--bridge-teal);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
    margin-bottom: 0.75rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .processing-title {
    font-family: 'DM Serif Display', serif;
    font-size: 1.5rem;
    color: var(--ink);
    margin-bottom: 0;
  }

  .processing-body {
    font-size: 0.92rem;
    color: var(--ink-mid);
    line-height: 1.55;
    max-width: 500px;
    margin: 0;
  }

  .processing-timer {
    font-size: 0.86rem;
    color: var(--ink-soft);
    line-height: 1.45;
    max-width: 500px;
    margin: 0;
  }

  .processing-steps {
    margin-top: 1.45rem;
    text-align: left;
    width: 100%;
    max-width: 420px;
  }

  .p-step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0.6rem 0;
    font-size: 0.88rem;
    color: var(--ink-soft);
    border-bottom: 1px solid var(--border);
  }

  .p-step:last-child { border-bottom: none; }
  .p-step.done { color: var(--bridge-teal); }
  .p-step.active { color: var(--ink); font-weight: 500; }

  .p-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .p-step.done .p-icon { background: var(--bridge-teal); border-color: var(--bridge-teal); color: white; }
  .p-step.active .p-icon { border-color: var(--bridge-teal); }

  /* -- Completion screen -- */
  .complete-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem 3rem;
  }

  .complete-icon {
    width: 72px;
    height: 72px;
    background: var(--bridge-teal-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .complete-icon svg { width: 36px; height: 36px; stroke: var(--bridge-teal); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .complete-headline {
    font-family: 'DM Serif Display', serif;
    font-size: 2rem;
    color: var(--ink);
    margin-bottom: 0.75rem;
    letter-spacing: -0.02em;
  }

  .complete-sub {
    font-size: 1rem;
    color: var(--ink-mid);
    line-height: 1.7;
    max-width: 620px;
    margin-bottom: 2rem;
  }

  .completion-layout {
    width: min(100%, 980px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.85rem;
    align-items: start;
    text-align: left;
  }

  .completion-layout.snapshot-simple {
    width: min(100%, 720px);
    grid-template-columns: minmax(0, 1fr);
    justify-content: center;
  }

  .completion-column {
    min-width: 0;
  }

  .completion-column.is-hidden {
    display: none;
  }

  .completion-column .next-steps {
    max-width: none;
  }

  .completion-swimlanes {
    display: grid;
    gap: 0.85rem;
  }

  .completion-lane {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-raised);
    padding: 1rem;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
  }

  .completion-lane-icon {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: var(--bridge-teal-light);
    color: var(--bridge-teal);
    font-size: 1.35rem;
    font-weight: 900;
  }

  .completion-lane h3 {
    margin: 0 0 0.25rem;
    color: var(--ink);
    font-size: 1rem;
  }

  .completion-lane p {
    margin: 0;
    color: var(--ink-mid);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .completion-lane-action {
    display: grid;
    justify-items: end;
    gap: 0.4rem;
    min-width: 220px;
  }

  .email-confirm-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    width: min(100%, 420px);
    border: 1px solid #c8e5dd;
    border-radius: 999px;
    background: #effaf7;
    color: var(--bridge-teal);
    padding: 0.3rem 0.45rem 0.3rem 0.72rem;
    font-size: 0.76rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .email-confirm-pill:focus-within {
    border-color: var(--bridge-teal);
    box-shadow: 0 0 0 3px rgba(0, 112, 96, 0.12);
  }

  .email-confirm-pill span {
    flex: 0 0 auto;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .email-confirm-pill input {
    min-width: 0;
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 0.82rem;
    text-align: left;
  }

  .email-confirm-pill input::placeholder {
    color: var(--ink-soft);
  }

  .field-status {
    min-height: 1.1rem;
    margin-top: 0.3rem;
    color: var(--ink-soft);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .field-status.ok {
    color: var(--bridge-teal);
  }

  .field-status.error {
    color: #a33a24;
  }

  .draft-save-status {
    display: none;
    margin: 1rem 0;
    padding: 0.85rem 1rem;
    border: 1px solid #b8ddd7;
    border-left: 5px solid var(--bridge-teal);
    border-radius: 8px;
    background: #f1fbf8;
    color: #164a43;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.4;
  }

  .draft-save-status:not(:empty) { display: block; }
  .draft-save-status.saving {
    border-color: #c8d5d2;
    border-left-color: #6a7f7a;
    background: #f5f8f7;
    color: #38504b;
  }
  .draft-save-status.error {
    border-color: #efc5bb;
    border-left-color: #a33a24;
    background: #fff4f1;
    color: #81301e;
  }

  .name-field input.field-invalid {
    border-color: #c45a42;
    box-shadow: 0 0 0 3px rgba(196, 90, 66, 0.12);
  }

  .completion-note {
    color: var(--ink-soft);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .completion-send-box {
    width: 100%;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-raised);
  }

  .completion-send-box .name-field {
    margin-bottom: 0;
  }

  .completion-send-copy {
    margin: -0.25rem 0 0.85rem;
    color: var(--ink-mid);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .deepen-interview-box {
    display: none;
    width: 100%;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid #bddbd4;
    border-left: 5px solid var(--bridge-teal);
    border-radius: var(--radius);
    background: #f2faf8;
  }

  .deepen-interview-box.active {
    display: block;
  }

  .deepen-interview-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 0.35rem;
  }

  .deepen-interview-copy {
    color: var(--ink-mid);
    font-size: 0.88rem;
    line-height: 1.55;
    margin-bottom: 0.85rem;
  }

  .completion-action-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.85rem;
  }

  .next-steps {
    width: 100%;
    max-width: 480px;
    text-align: left;
  }

  .next-steps-title {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-bottom: 1rem;
  }

  .next-step-card {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .next-step-num {
    width: 28px;
    height: 28px;
    background: var(--bridge-teal);
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 600;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .next-step-content { flex: 1; }
  .next-step-title { font-size: 0.92rem; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
  .next-step-desc { font-size: 0.85rem; color: var(--ink-mid); line-height: 1.5; }

  .complete-footer {
    margin-top: 2rem;
    font-size: 0.82rem;
    color: var(--ink-soft);
    line-height: 1.6;
  }

  .complete-footer a { color: var(--bridge-teal); text-decoration: none; }

  @media (max-width: 760px) {
    .completion-lane {
      grid-template-columns: 1fr;
    }
    .completion-lane-action {
      justify-items: stretch;
      min-width: 0;
    }
    .email-confirm-pill {
      max-width: 100%;
    }
  }

  /* -- Error banner -- */
  .error-banner {
    background: #fdf2f2;
    border: 1px solid #f5c6c6;
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    font-size: 0.88rem;
    color: var(--danger);
    margin-bottom: 1rem;
    display: none;
  }

  /* -- Footer -- */
  .footer {
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-copy {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .footer-privacy {
    font-size: 0.78rem;
    color: var(--ink-soft);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .footer-privacy a { color: var(--bridge-teal); text-decoration: none; }
  .footer-privacy a:hover { text-decoration: underline; }

  .lock-icon {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  @media (max-width: 600px) {
    .welcome-headline { font-size: 1.8rem; }
    .question-text { font-size: 1.3rem; }
    .main { padding: 2rem 1rem 3rem; }
    .header { padding: 1rem 1.25rem; }
    .snapshot-outcomes { grid-template-columns: 1fr; }
    .payoff-grid,
    .payoff-path {
      grid-template-columns: 1fr;
    }
    .payoff-top {
      align-items: flex-start;
      flex-direction: column;
    }
    .payoff-note {
      text-align: left;
    }
    .chart-row {
      grid-template-columns: 82px minmax(0, 1fr) 34px;
    }
  }

  @media (max-width: 900px) {
    .completion-layout {
      grid-template-columns: 1fr;
    }

    #screen-welcome {
      max-width: 640px;
    }

    .welcome-layout {
      grid-template-columns: 1fr;
    }

    .snapshot-splash {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .splash-visual {
      min-height: 520px;
    }

    .visual-path {
      grid-template-columns: 1fr;
    }

    .welcome-form-panel {
      padding: 0;
      border: 0;
      box-shadow: none;
      background: transparent;
    }
  }
</style>
</head>
<body>

<header class="header">
  <div class="logo">
    <div class="logo-mark">
      <img src="/assets/brand/sil-trust-seal.png" alt="" aria-hidden="true">
    </div>
    <span class="logo-text">Bridge <span>To AI</span></span>
    <div class="partner-header-logo" id="partner-header-logo">
      <span>For</span>
      <img id="partner-header-logo-img" alt="">
    </div>
  </div>
  <div class="header-tag-wrap">
    <span class="header-tag" id="header-tag">Business Discovery Session</span>
      <span class="header-version">v1.72.32 Preview</span>
  </div>
</header>

<main class="main">

  <!-- -- Screen 1: Welcome -- -->
  <div class="screen active" id="screen-welcome">
    <div class="partner-banner" id="partner-banner">
      <div class="partner-banner-inner">
        <div>
          <div class="partner-pill" id="partner-pill">AFPA Member Program</div>
          <div id="partner-banner-text">This intake helps shape practical AI education and support for participating members.</div>
        </div>
        <div class="partner-logo-card" id="partner-logo-card">
          <img id="partner-logo-img" alt="">
        </div>
      </div>
    </div>

    <div class="afpa-course-front" id="afpa-course-front">
      <section class="afpa-hero-panel" aria-labelledby="afpa-front-title">
        <div>
          <div class="afpa-front-eyebrow">AFPA member AI training needs intake</div>
          <h1 id="afpa-front-title">Help shape practical AI training for <em>Alberta food processors</em>.</h1>
          <p class="afpa-front-lead">
            This private Bridge To AI interview helps identify what AFPA members need most from upcoming AI education: practical examples, safe first uses, workflow bottlenecks, readiness gaps, and the training formats members can actually use.
          </p>
          <div class="afpa-front-actions">
            <button class="btn-primary" type="button" onclick="openAfpaCourseStart()">Continue to interview</button>
            <button class="btn-secondary" type="button" onclick="openAfpaCourseResume()">Resume previous session</button>
          </div>
          <div class="afpa-resume-status" id="afpa-resume-status" role="status"></div>
          <div class="afpa-front-trust">
            <img src="/assets/brand/sil-trust-seal.png" alt="Bridge To AI Secure Intelligence Layer">
            <span><strong>Privacy-first processing.</strong> Your raw answers are used for your private report. AFPA receives anonymized aggregate themes for education planning, not individual interview files.</span>
          </div>
        </div>
      </section>

      <aside class="afpa-insight-panel" aria-label="What this AFPA intake helps identify">
        <h2>What this helps AFPA understand</h2>
        <div class="afpa-insight-card">
          <strong>Training topics</strong>
          <span>Where members most need practical AI help: admin, sales, production, QA, compliance, reporting, customer service, or planning.</span>
        </div>
        <div class="afpa-insight-card">
          <strong>Common workflow drag</strong>
          <span>The repeated work, handoffs, data gaps, and review points that make AI training immediately useful.</span>
        </div>
        <div class="afpa-insight-card">
          <strong>Safe adoption boundaries</strong>
          <span>What members are comfortable trying first, and what should stay human-reviewed because privacy, safety, accuracy, or trust matters.</span>
        </div>
        <div class="afpa-insight-card">
          <strong>Course design signals</strong>
          <span>Whether members need workshops, templates, examples, checklists, office hours, or done-with-you support.</span>
        </div>
      </aside>
    </div>

    <div class="snapshot-splash" id="snapshot-splash">
      <section class="splash-copy" aria-labelledby="splash-title">
        <div class="brand-proof">
          <img src="/assets/brand/sil-trust-seal.png" alt="" aria-hidden="true">
          Secure Intelligence Layer
        </div>
        <div class="splash-kicker">Free AI Opportunity Snapshot</div>
        <h1 class="splash-title" id="splash-title">Where is AI hiding <em>time back</em> in your business?</h1>
        <p class="splash-lead">
          Take 8-12 minutes and Bridge To AI will look for the repeated work, delays, handoffs, and review points that could become your safest first AI win.
        </p>
        <div class="splash-actions">
          <button class="btn-primary" type="button" onclick="openSnapshotStart()">Start the snapshot interview</button>
          <button class="btn-secondary" type="button" onclick="openSnapshotResume()">Resume previous session</button>
        </div>
        <div class="hero-sil-card" aria-label="Bridge To AI Secure Intelligence Layer">
          <img src="/assets/brand/sil-trust-seal.png" alt="">
          <span><strong>Protected by Bridge To AI's Secure Intelligence Layer</strong> Encrypted intake, privacy-first AI processing, controlled use, and private report delivery.</span>
        </div>
        <p class="splash-trust-line">
          You get a private first-pass report with a likely first use case, readiness signals, what not to automate yet, and one useful next move. No private financials, recipes, customer lists, supplier contracts, payroll details, invoices, or confidential formulas.
        </p>
      </section>

      <section class="splash-visual" aria-label="Illustrative AI opportunity visual">
        <div class="visual-row">
          <div class="visual-card dark big-metric branded-report">
            <img class="report-seal" src="/assets/brand/sil-trust-seal.png" alt="">
            <div class="report-preview-title">Private Snapshot Report</div>
            <div>
              <div class="metric-number">5</div>
              <div class="metric-label">signals in your Snapshot Scorecard</div>
              <div class="metric-note">Directional, evidence-based, and grounded in what you actually say.</div>
            </div>
            <div class="report-preview-line" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="visual-card">
            <strong style="display:block;color:var(--ink);font-size:0.86rem;margin-bottom:0.55rem;">Snapshot Scorecard preview</strong>
            <div class="scorecard-preview">
              <div class="score-row"><span>Workflow Drag</span><span class="score-pill">High friction</span></div>
              <div class="score-row"><span>AI Fit</span><span class="score-pill">Good first test</span></div>
              <div class="score-row"><span>Information Readiness</span><span class="score-pill">Cleanup first</span></div>
              <div class="score-row"><span>Human Review Boundary</span><span class="score-pill">Keep in loop</span></div>
            </div>
          </div>
        </div>

        <div class="visual-card">
          <strong style="display:block;color:var(--ink);font-size:0.86rem;">What the free report tries to answer</strong>
          <div class="report-strip">
            <span>Where is the repeated work creating drag?</span>
            <span>What is the safest useful AI task to test first?</span>
            <span>What should wait until the deeper interview confirms more detail?</span>
          </div>
        </div>

        <div class="visual-path">
          <div class="visual-card mini-step">
            <strong>Evidence</strong>
            <span>Your answers describe the workflow, delays, handoffs, and boundaries.</span>
          </div>
          <div class="visual-card mini-step">
            <strong>Scorecard</strong>
            <span>Bridge To AI turns those answers into five practical directional signals.</span>
          </div>
          <div class="visual-card mini-step">
            <strong>First move</strong>
            <span>You get one safe prompt or next step before anyone talks about a build.</span>
          </div>
        </div>
      </section>
    </div>

    <div class="welcome-layout" id="welcome-detail">
      <div class="welcome-copy-panel">
        <div class="welcome-eyebrow" id="welcome-eyebrow">Confidential - for your eyes only</div>
        <h1 class="welcome-headline" id="welcome-headline">Let's understand your business <em>before</em> we talk about AI.</h1>
        <p class="welcome-body" id="welcome-body">
          This session usually takes about 20-30 minutes. There are no right or wrong answers.
          General ranges and directional examples are enough for this first report; please do not
          enter private financials, recipes, customer lists, supplier contracts, payroll details,
          invoices, or confidential operating data. The interview includes core questions and may
          add short follow-up questions when an answer needs more context. More detailed answers
          usually help us move faster and reduce the need for follow-ups. Your answers are
          encrypted, stored securely, and used only to prepare your private AI opportunity report.
        </p>

        <div class="ai-payoff-dashboard" aria-label="Illustrative AI payoff dashboard">
          <div class="payoff-top">
            <div class="payoff-title" id="payoff-title">What AI usually starts with: time leaks</div>
            <div class="payoff-note" id="payoff-note">Illustrative signals. Your snapshot uses your answers.</div>
          </div>
          <div class="payoff-grid">
            <div class="time-gauge" aria-label="Snapshot Scorecard signal count">
              <div class="gauge-eyebrow">YOUR PRIVATE SNAPSHOT</div>
              <div class="gauge-number" id="gauge-number">5</div>
              <div class="gauge-label" id="gauge-label">signals we review</div>
              <div class="gauge-dots" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
              <div class="gauge-sub" id="gauge-sub">One clear starting point for AI</div>
            </div>
            <div class="payoff-chart" aria-label="Snapshot Scorecard preview">
              <div class="scorecard-preview">
                <div class="score-row"><span>Workflow Drag</span><span class="score-pill">High friction</span></div>
                <div class="score-row"><span>AI Fit</span><span class="score-pill">Good AI fit</span></div>
                <div class="score-row"><span>Information Readiness</span><span class="score-pill">Cleanup first</span></div>
                <div class="score-row"><span>Human Review Boundary</span><span class="score-pill">Human review</span></div>
                <div class="score-row"><span>First Useful Win</span><span class="score-pill">Ready to test</span></div>
              </div>
            </div>
          </div>
          <div class="payoff-path">
            <div class="path-step">
              <strong id="path-title-1">Messy workflow</strong>
              <span id="path-copy-1">Where work repeats, waits, or depends on memory.</span>
            </div>
            <div class="path-step">
              <strong id="path-title-2">AI-fit signal</strong>
              <span id="path-copy-2">What can be drafted, organized, checked, or summarized.</span>
            </div>
            <div class="path-step">
              <strong id="path-title-3">First useful win</strong>
              <span id="path-copy-3">One safe place to test AI without overbuilding.</span>
            </div>
          </div>
        </div>

        <div class="snapshot-outcomes" aria-label="Snapshot outcomes">
          <div class="outcome-chip">
            <strong id="outcome-title-1">Best first use case</strong>
            <span id="outcome-copy-1">Find the workflow where AI is most likely to help first.</span>
          </div>
          <div class="outcome-chip">
            <strong id="outcome-title-2">Readiness signals</strong>
            <span id="outcome-copy-2">See whether you are ready now or need cleanup first.</span>
          </div>
          <div class="outcome-chip">
            <strong id="outcome-title-3">A practical next move</strong>
            <span id="outcome-copy-3">Get one useful step you can try without buying anything.</span>
          </div>
        </div>

        <div class="snapshot-result-panel">
          <div class="snapshot-result-title" id="snapshot-result-title">What your free snapshot can show you</div>
          <ul class="snapshot-result-list">
            <li><span class="result-check">✓</span><span id="result-item-1">Where repeated work is costing time, consistency, or follow-up.</span></li>
            <li><span class="result-check">✓</span><span id="result-item-2">Which AI help looks safe to try first, and what should stay human-reviewed.</span></li>
            <li><span class="result-check">✓</span><span id="result-item-3">Whether your templates, forms, emails, SOPs, or spreadsheets are enough to start from.</span></li>
            <li><span class="result-check">✓</span><span id="result-item-4">What a deeper interview would need before anyone promises a build plan.</span></li>
          </ul>
        </div>

        <div class="evidence-first-box">
          <strong id="evidence-title">Evidence-first, privacy-aware, built for useful answers</strong>
          <p id="evidence-copy">
            We have programmed the analysis to work from what you actually tell us. If the answers are vague, the snapshot will say so. If you are honest about what is messy, slow, repeated, or unclear, the report can point to a more useful first AI win, the cleanup needed first, and the work that should stay human-reviewed.
          </p>
        </div>

        <div class="white-label-note" id="white-label-note">
          <strong>For associations, training groups, and business communities:</strong>
          this intake can be adapted to help you teach practical AI based on what your members actually need.
        </div>

        <div class="powered-by-badge-row">
          <img src="/assets/brand/sil-trust-seal.png" alt="Bridge To AI Secure Intelligence Layer">
          <span><strong>Protected by the BTAI Secure Intelligence Layer</strong> Bridge To AI can power intake campaigns while keeping individual answers private and partner reporting aggregate-only.</span>
        </div>

        <div class="welcome-steps">
          <p>How this works</p>
          <ul class="step-list">
            <li><span class="step-num">1</span> <span id="step-one-text">You'll start with a quick scenario, then move through 8 areas of your business and a short reflection on you as the owner.</span></li>
            <li><span class="step-num">2</span> Speak your answer using the microphone, or type it directly.</li>
            <li><span class="step-num">3</span> Review what was captured, edit if needed, then hit Continue.</li>
            <li><span class="step-num">4</span> <span id="step-four-text">A few answers may trigger a quick follow-up so we can understand the real issue instead of guessing. Your progress is saved securely as you go, and your first report is based on directional business signals rather than confidential operating details.</span></li>
          </ul>
        </div>
      </div>

      <div class="welcome-form-panel">
        <div class="brand-trust-panel">
          <img src="/assets/brand/sil-trust-seal.png" alt="Bridge To AI Secure Intelligence Layer">
          <div>
            <strong>Privacy-first AI processing</strong>
            <span>Encrypted intake, controlled use, and private report delivery before any partner aggregate insight is considered.</span>
          </div>
        </div>
        <div class="welcome-form-title">Start here</div>

        <div class="resume-card" id="resume-card">
          <div class="resume-title">Resume your previous session?</div>
          <div class="resume-body" id="resume-summary">We found saved progress from this browser.</div>
          <div class="resume-actions">
            <button class="btn-primary" type="button" onclick="resumeSavedInterview()">Resume session</button>
            <button class="btn-secondary" type="button" onclick="clearSavedInterview(true)">Start over</button>
          </div>
        </div>

        <div class="name-field">
          <label for="client-name">Your name</label>
          <input type="text" id="client-name" placeholder="e.g. Jane Smith" autocomplete="off" />
        </div>

        <div class="name-field">
          <label for="client-email">Email for your report link</label>
          <input type="email" id="client-email" placeholder="e.g. jane@yourbusiness.ca" autocomplete="email" />
          <div class="field-status" id="client-email-status" aria-live="polite"></div>
        </div>

        <div class="name-field">
          <label for="business-name">Your business name</label>
          <input type="text" id="business-name" placeholder="e.g. Acme Plumbing Ltd." autocomplete="off" />
        </div>

        <div class="name-field">
          <label for="business-niche">What does your business do?</label>
          <input type="text" id="business-niche" maxlength="160" placeholder="e.g. plumbing contractor, bookkeeping practice, online retailer, local manufacturer..." autocomplete="off" />
          <div class="field-help">A simple description is enough. We use this to make the questions more relevant.</div>
        </div>

        <div class="name-field">
          <label for="share-comfort">For this first intake, how much detail are you comfortable sharing?</label>
          <select id="share-comfort">
            <option value="Directional only">Directional only</option>
            <option value="General ranges are okay">General ranges are okay</option>
            <option value="I may share more in a private scoping session">I may share more in a private scoping session</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </div>

        <div class="name-field">
          <label for="website-url">Business website <span style="font-weight:400;color:var(--ink-soft);">(optional)</span></label>
          <input type="url" id="website-url" placeholder="e.g. https://yourbusiness.ca" autocomplete="off" />
        </div>

        <div class="name-field">
          <label for="company-size">Roughly how many people work in your business?</label>
          <input type="text" id="company-size" placeholder="e.g. 1, 8, 45..." autocomplete="off" inputmode="numeric" />
        </div>

        <div class="name-field">
          <label for="owner-work-status">How are you involved in the business right now? <span style="font-weight:400;color:var(--ink-soft);">(optional, but helps tailor the questions)</span></label>
          <input type="text" id="owner-work-status" placeholder="e.g. full-time owner, semi-retired, side business, managing a team..." autocomplete="off" />
        </div>

        <div class="name-field">
          <label>Which departments or functions does your business have? <span style="font-weight:400;color:var(--ink-soft);">(tap all that apply)</span></label>
          <div class="dept-grid">
            <label class="dept-pill"><input type="checkbox" value="Sales"><span>Sales</span></label>
            <label class="dept-pill"><input type="checkbox" value="Marketing"><span>Marketing</span></label>
            <label class="dept-pill"><input type="checkbox" value="Operations"><span>Operations</span></label>
            <label class="dept-pill"><input type="checkbox" value="Finance / Accounting"><span>Finance / Accounting</span></label>
            <label class="dept-pill"><input type="checkbox" value="Customer Service"><span>Customer Service</span></label>
            <label class="dept-pill"><input type="checkbox" value="Production / Fulfillment"><span>Production / Fulfillment</span></label>
            <label class="dept-pill"><input type="checkbox" value="HR / People"><span>HR / People</span></label>
            <label class="dept-pill"><input type="checkbox" value="IT / Tech"><span>IT / Tech</span></label>
            <label class="dept-pill"><input type="checkbox" value="Admin"><span>Admin</span></label>
            <label class="dept-pill"><input type="checkbox" value="It's mostly just me"><span>It's mostly just me</span></label>
          </div>
        </div>

        <div class="consent-box">
          <label class="consent-label" for="privacy-consent">
            <input type="checkbox" id="privacy-consent" />
            <span>
              I agree to the <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
              and consent to Bridge To AI securely processing my interview responses to prepare my private AI opportunity report and related service materials.
              <span class="partner-consent-note" id="partner-consent-note">
                I understand that anonymized, aggregated insights from participating members may be shared with the partner organization for education, course planning, and member-support strategy. Raw interview records and individual answers are not shared with the partner.
              </span>
            </span>
          </label>
        </div>

        <div id="welcome-error" class="error-banner">Please fill in your name, valid email, business name, what your business does, and privacy consent before continuing.</div>
        <div class="draft-save-status" id="draft-save-status" aria-live="polite"></div>

        <button class="btn-primary" onclick="startInterview(event)" style="width:100%;">
          Begin my discovery session ->
        </button>
      </div>
    </div>
  </div>

  <!-- -- Screen 2: Interview -- -->
  <div class="screen" id="screen-interview">
    <div class="progress-wrap">
      <div class="progress-meta">
        <span class="progress-label" id="progress-label">Domain 1 of 8</span>
        <span class="progress-count" id="progress-count">Question 1</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill" style="width: 9%"></div>
      </div>
    </div>

    <div class="question-domain" id="q-domain">Business Model & Direction</div>
    <div class="question-text" id="q-text">How does your business make money today?</div>
    <div class="question-hint" id="q-hint">Your core products or services, who pays for them, and whether the money is one-time, recurring, or project-based.</div>

    <div id="answer-error" class="error-banner">Please share your thoughts before continuing - there are no wrong answers.</div>

    <div class="input-area">
      <div
        class="transcript-box"
        id="transcript"
        contenteditable="true"
        data-placeholder="Tap the mic and speak your answer. To fix or change anything, pause the mic first, then type - turn it back on to keep talking."
      ></div>
      <div class="input-toolbar">
        <button class="voice-btn" id="voice-btn" onclick="toggleRecording()">
          <span class="mic-dot"></span>
          <span id="voice-label">Click to speak</span>
        </button>
        <span class="char-count" id="char-count">0 words</span>
      </div>
    </div>

    <div class="nav-row">
      <button type="button" class="btn-secondary" id="btn-back" onclick="prevQuestion()"><- Back</button>
      <span class="nav-reassure">You can go back anytime to review or change an answer</span>
      <button type="button" class="btn-primary" id="btn-next" onclick="nextQuestion()">Continue -></button>
    </div>
  </div>

  <!-- -- Screen 3: Processing -- -->
  <div class="screen" id="screen-processing">
    <div class="processing-wrap">
      <div class="spinner"></div>
      <div class="processing-title" id="processing-title">Creating your private business profile...</div>
      <p class="processing-body" id="processing-body">
        Your answers are being turned into a secure business profile. The free report is prepared after your secure record is saved, and deeper reports are generated only when requested.
      </p>
      <p class="processing-timer" id="processing-timer">
        Working for 0:00. Please keep this tab open until you see the confirmation screen.
      </p>
      <div class="processing-steps">
        <div class="p-step active" id="pstep-1">
          <div class="p-icon">1</div>
          <span id="pstep-1-label">Reviewing the full interview</span>
        </div>
        <div class="p-step" id="pstep-2">
          <div class="p-icon">2</div>
          <span id="pstep-2-label">Creating the secure business profile</span>
        </div>
        <div class="p-step" id="pstep-3">
          <div class="p-icon">3</div>
          <span id="pstep-3-label">Preparing report-ready insights</span>
        </div>
        <div class="p-step" id="pstep-4">
          <div class="p-icon">4</div>
          <span id="pstep-4-label">Saving encrypted records securely</span>
        </div>
      </div>
    </div>
  </div>

  <!-- -- Screen 4: Complete -- -->
  <div class="screen" id="screen-complete">
    <div class="complete-wrap">
      <div class="complete-icon">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 class="complete-headline">You're all done.</h2>
      <p class="complete-sub" id="complete-message">
        Thank you. Your business profile has been encrypted and sent to the Bridge Team securely.
        They'll review it before your next conversation and use it to build
        something that actually fits how your business works.
      </p>

      <div class="completion-layout">
        <section class="completion-column" aria-labelledby="free-report-title">
          <div class="completion-swimlanes">
            <article class="completion-lane">
              <div class="completion-lane-icon">1</div>
              <div>
                <h3 id="free-report-title">Your free report is prepared by email</h3>
                <p id="next-desc-1">Bridge To AI sends your private AI Opportunity Snapshot to the email address you provided at the start.</p>
              </div>
              <div class="completion-lane-action">
                <label class="email-confirm-pill" for="completion-email-input">
                  <span>Send to</span>
                  <input type="email" id="completion-email-input" autocomplete="email" inputmode="email" placeholder="your email" />
                </label>
                <button type="button" class="btn-primary" id="report-delivery-btn" onclick="handleReportDeliveryButton()">Email my free report</button>
                <span id="followup-save-status" class="completion-note"></span>
              </div>
            </article>

            <article class="completion-lane">
              <div class="completion-lane-icon">2</div>
              <div>
                <h3 id="next-title-2">Your email includes the next options</h3>
                <p id="next-desc-2">The report email will include links for the Detailed AI Opportunity Report, Preliminary AI Action Plan, and implementation/workbench support if you want to go further.</p>
              </div>
              <div class="completion-lane-action">
                <span class="completion-note">No decision needed on this page.</span>
              </div>
            </article>

            <article class="completion-lane">
              <div class="completion-lane-icon">3</div>
              <div>
                <h3 id="next-title-3">AFPA receives aggregate themes only</h3>
                <p id="next-desc-3">Your individual answers and raw interview record are not shared with AFPA. AFPA may receive anonymized themes to help shape member AI education.</p>
              </div>
              <div class="completion-lane-action">
                <span class="completion-note">Privacy-first partner reporting.</span>
              </div>
            </article>

            <article class="completion-lane">
              <div class="completion-lane-icon">4</div>
              <div>
                <h3>Questions or delivery trouble?</h3>
                <p>Reach the Bridge Team at <a href="mailto:team@bridgetoai.ca">team@bridgetoai.ca</a>. If report delivery does not confirm, we can recover the report from the secure record.</p>
              </div>
              <div class="completion-lane-action">
                <span class="completion-note">Your answers remain private.</span>
              </div>
            </article>
          </div>

          <div class="deepen-interview-box" id="deepen-interview-box">
            <div class="deepen-interview-title">Want a more complete diagnostic while the context is fresh?</div>
            <p class="deepen-interview-copy">
              Your free snapshot is already handled. If you want to keep going, we can ask the remaining deeper questions in this same secure session so Bridge To AI has a fuller brief to work from.
            </p>
            <button type="button" class="btn-secondary" id="continue-deep-btn" onclick="continueIntoDeepDiagnostic()">Continue deeper interview</button>
          </div>
        </section>
      </div>

      <p class="complete-footer">
        Protected by Bridge To AI's Secure Intelligence Layer.
      </p>
    </div>
  </div>

</main>

<footer class="footer">
  <span class="footer-copy">(c) 2026 Bridge To AI</span>
  <span class="footer-privacy">
    <img class="lock-icon" src="/assets/brand/sil-lock-mark.png" alt="" aria-hidden="true">
    Your answers are private and encrypted · <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
  </span>
</footer>

<script>
// -- Configuration ----------------------------------------------------------
// IMPORTANT: Replace these with your actual values before deploying
const CONFIG = {
  EMAIL_ENDPOINT: '/api/send-email',              // Vercel serverless function endpoint
  REPORT_PACK_ENDPOINT: '/api/report-pack',
  DARREN_EMAIL: 'team@bridgetoai.ca',               // Intake delivery address; forwards to Darren via Resend/email routing
  DEFAULT_PARTNER: 'BTAI',
  DEFAULT_CAMPAIGN: 'general_intake'
};
const PRIVACY_POLICY_VERSION = '2026-07-25-v1.56.1';

const PARTNER_PROFILES = {
  AFPA: {
    displayName: 'Alberta Food Processors Association',
    shortName: 'AFPA',
    logoSrc: '/assets/partners/afpa-logo.png',
    logoAlt: 'Alberta Food Processors Association',
    headerTag: 'AFPA Member AI Readiness Intake',
    pill: 'AFPA Member Program',
    eyebrow: 'Confidential AFPA member intake',
    headline: 'Help shape practical AI training for Alberta food processors.',
    body: 'This session usually takes about 15-25 minutes. Your answers help prepare your private AI opportunity report and help AFPA understand, in anonymized aggregate form, what members need most from upcoming AI education. General ranges and directional examples are enough; please avoid private financials, recipes, customer lists, supplier contracts, payroll details, invoices, or confidential operating data. The 20-question interview focuses on practical training needs, repeated work, niche-specific examples, information readiness, comfort boundaries, and safe first AI uses. Your answers are encrypted and stored securely.',
    banner: 'This co-branded intake is provided for AFPA members and powered by Bridge To AI. AFPA receives anonymized aggregate insights for education and program planning, not raw member interview files.',
    stepOne: 'You will move through practical questions that help identify what AI training, examples, templates, workflow support, and safer implementation guidance may help AFPA members most.',
    stepFour: 'A few answers may trigger a quick follow-up when more context is needed. Your progress is saved securely as you go, and you can resume if you need to come back later.',
    completion: 'Your AFPA member AI readiness intake has been encrypted and securely saved. Bridge To AI will use it to prepare your private AI opportunity report. AFPA may receive anonymized aggregate insights to help shape member education, but your raw interview record is not shared with AFPA.',
    nextSteps: [
      ['Bridge To AI prepares your free snapshot', 'Your answers will be used to prepare a private AI Opportunity Snapshot focused on practical next steps for your business.'],
      ['AFPA receives anonymized member insights', 'AFPA may receive aggregate themes to help shape the December AI course and future member support. Individual answers and raw records are not shared.'],
      ['You choose whether to go deeper', 'If you ask for follow-up, Bridge To AI can discuss deeper reports, implementation planning, or custom AI workbench support.']
    ]
  }
};

const INDUSTRY_PACKS = {
  trade_field_services: {
    id: 'trade_field_services',
    label: 'Trade Services / Field Services',
    shortLabel: 'trade or field service business',
    aliases: ['home builder', 'builder', 'contractor', 'renovation', 'electrician', 'plumber', 'hvac', 'roofer', 'landscaper', 'arborist', 'tree service', 'restoration', 'field service', 'trades'],
    subtypes: ['Builder / renovation contractor', 'Electrical / plumbing / HVAC', 'Roofing / exterior work', 'Landscaping / tree service', 'Restoration / emergency service', 'Other trade or field service'],
    opportunities: ['lead intake', 'quote requests', 'site visits', 'job photos', 'crew scheduling', 'dispatch handoffs', 'materials coordination', 'change requests', 'customer updates', 'invoice follow-up', 'warranty/service history'],
    customerTypes: ['homeowners', 'property managers', 'commercial accounts', 'repeat service customers', 'larger project clients', 'maintenance customers', 'referral partners'],
    workflowExamples: ['lead to quote', 'site visit to estimate', 'scheduled job to crew handoff', 'field notes to invoice', 'customer update to follow-up'],
    riskBoundaries: ['safety decisions', 'code or inspection decisions', 'legal disputes', 'insurance claims', 'customer private addresses beyond what is needed', 'payment details', 'employee personal information'],
    reportFraming: 'Look first at the handoff from inquiry to quote, scheduled job, field notes, customer update, and invoice/follow-up.'
  },
  healthcare_care_services_non_clinical: {
    id: 'healthcare_care_services_non_clinical',
    label: 'Healthcare & Care Services: Non-Clinical Operations',
    shortLabel: 'non-clinical healthcare or care-services business',
    aliases: ['doctor', 'clinic', 'medical office', 'nurse practitioner', 'dentist', 'dental', 'home care', 'physio', 'physiotherapy', 'chiropractor', 'allied health', 'wellness clinic', 'care service', 'senior care'],
    subtypes: ['Medical clinic / doctor office', 'Dental office', 'Home care agency', 'Allied health / therapy clinic', 'Wellness or care-services office', 'Other non-clinical care operation'],
    opportunities: ['appointment requests', 'intake forms', 'reminders', 'cancellations', 'referral tracking', 'phone messages', 'document routing', 'staff handoffs', 'billing admin', 'policy/SOP updates', 'supply ordering'],
    customerTypes: ['patients or clients', 'care recipients', 'families/caregivers', 'referring offices', 'staff teams', 'administrative leads'],
    workflowExamples: ['appointment request to booking', 'form intake to admin review', 'referral received to follow-up', 'phone message to staff handoff', 'policy update to staff checklist'],
    riskBoundaries: ['diagnosis', 'treatment advice', 'care planning', 'medication decisions', 'clinical triage', 'patient chart details', 'health card numbers', 'lab results', 'identifiable patient/client information'],
    reportFraming: 'Keep recommendations limited to non-clinical operations: scheduling, forms, reminders, routing, internal SOPs, and administrative handoffs.'
  },
  food_processing_manufacturing_distribution: {
    id: 'food_processing_manufacturing_distribution',
    label: 'Food Processing / Manufacturing / Distribution',
    shortLabel: 'food, manufacturing, or distribution business',
    aliases: ['food processor', 'food processing', 'copacker', 'co-packer', 'contract manufacturer', 'cpg', 'food brand', 'food manufacturer', 'food manufacturing', 'distributor', 'wholesaler', 'importer', 'commissary', 'beverage', 'bakery', 'meat', 'seafood', 'dairy', 'produce', 'prepared foods'],
    subtypes: ['Food processor / manufacturer', 'Copacker / contract manufacturer', 'Food brand / CPG company', 'Distributor / wholesaler / importer', 'Foodservice production / commissary', 'Value-added agriculture', 'Other food or beverage business'],
    productAreas: ['Bakery / baked goods', 'Beverage / bottling', 'Meat / seafood / protein', 'Dairy / cheese', 'Produce / value-added farm product', 'Prepared foods / ready-to-eat', 'Sauces / condiments / preserves', 'Snacks / shelf-stable packaged goods', 'Other'],
    opportunities: ['order intake', 'production planning', 'batch/SKU coordination', 'QA records', 'label or spec-sheet updates', 'inventory visibility', 'buyer follow-up', 'supplier updates', 'shipping exceptions', 'SOP capture', 'training templates'],
    customerTypes: ['retail buyers', 'foodservice accounts', 'distributors', 'brokers', 'private-label customers', 'direct customers', 'regional accounts'],
    workflowExamples: ['order to production run', 'buyer request to spec sheet', 'QA note to corrective action', 'supplier document to internal record', 'shipment update to customer follow-up'],
    riskBoundaries: ['recipes', 'confidential formulas', 'supplier contracts', 'customer lists', 'private financials', 'payroll', 'invoices', 'food safety decisions without review', 'regulated compliance decisions'],
    reportFraming: 'Look at repeated admin around orders, production, QA/compliance-adjacent records, buyer follow-up, document control, and planning.'
  },
  manufacturing_operations: {
    id: 'manufacturing_operations',
    label: 'Manufacturing / Operations Business',
    shortLabel: 'manufacturing or operations business',
    aliases: ['manufacturer', 'manufacturing', 'fabrication', 'fabricator', 'machine shop', 'assembly', 'industrial', 'production shop'],
    subtypes: ['Fabrication / machine shop', 'Assembly / production', 'Industrial supplier', 'Custom manufacturer', 'Other manufacturing operation'],
    opportunities: ['quote requests', 'job intake', 'production planning', 'work-order coordination', 'quality records', 'inventory visibility', 'supplier updates', 'shipping exceptions', 'SOP capture', 'training templates'],
    customerTypes: ['commercial accounts', 'industrial buyers', 'contract customers', 'distributors', 'repeat customers', 'project clients'],
    workflowExamples: ['quote request to work order', 'work order to production plan', 'quality note to corrective action', 'supplier update to internal record', 'shipment update to customer follow-up'],
    riskBoundaries: ['proprietary designs', 'customer specifications', 'supplier contracts', 'private financials', 'payroll', 'invoices', 'safety decisions without review', 'regulated compliance decisions'],
    reportFraming: 'Look at repeated admin around quotes, work orders, production coordination, quality records, customer updates, and planning.'
  },
  professional_services_advisory: {
    id: 'professional_services_advisory',
    label: 'Professional Services / Advisory Businesses',
    shortLabel: 'professional services or advisory business',
    aliases: ['business coach', 'coach', 'consultant', 'advisor', 'bookkeeper', 'bookkeeping', 'accountant', 'insurance broker', 'real estate', 'hr consultant', 'trainer', 'facilitator', 'agency', 'professional services'],
    subtypes: ['Business coach / consultant', 'Bookkeeping / accounting', 'Broker / advisor', 'Training / facilitation', 'Agency / marketing services', 'Other professional service'],
    opportunities: ['client intake', 'discovery notes', 'proposal drafting', 'scope control', 'session summaries', 'follow-up emails', 'progress tracking', 'reporting', 'resource reuse', 'workshop preparation'],
    customerTypes: ['retainer clients', 'project clients', 'referral partners', 'workshop participants', 'business owners', 'professional buyers'],
    workflowExamples: ['lead to discovery call', 'session notes to action items', 'proposal request to scope draft', 'client check-in to follow-up', 'repeat advice to reusable resource'],
    riskBoundaries: ['confidential client strategy', 'legal advice', 'regulated financial advice', 'HR records', 'therapy-like disclosures', 'private customer data', 'contracts', 'payment details'],
    reportFraming: 'Look first at client intake, notes, proposals, follow-up, repeated advice, reporting, and reusable knowledge.'
  },
  general_business: {
    id: 'general_business',
    label: 'General Business Operations',
    shortLabel: 'business',
    aliases: [],
    subtypes: ['Product business', 'Service business', 'Local business', 'Online business', 'Association / training organization', 'Other'],
    opportunities: ['customer follow-up', 'admin work', 'reporting', 'sales support', 'operations checklists', 'training material', 'marketing content', 'decision support'],
    customerTypes: ['repeat customers', 'larger accounts', 'online/direct customers', 'referral partners', 'strategic partnerships', 'new markets'],
    workflowExamples: ['lead to follow-up', 'task to handoff', 'notes to report', 'request to response', 'workaround to repeatable process'],
    riskBoundaries: ['private financials', 'customer names', 'supplier contracts', 'payroll', 'invoices', 'regulated data', 'confidential formulas', 'passwords or keys'],
    reportFraming: 'Look for repeated work, unclear handoffs, scattered information, and low-risk first AI support.'
  }
};

const LEGACY_CATEGORY_PACK_MAP = {
  'Bakery / Grains': 'food_processing_manufacturing_distribution',
  'Beverages': 'food_processing_manufacturing_distribution',
  'Meat / Protein': 'food_processing_manufacturing_distribution',
  'Produce / Fresh Pack': 'food_processing_manufacturing_distribution',
  'Prepared Foods': 'food_processing_manufacturing_distribution',
  'Distribution / Wholesale': 'food_processing_manufacturing_distribution',
  'Retail / Food Service': 'food_processing_manufacturing_distribution',
  'Manufacturing': 'manufacturing_operations',
  'Professional Services': 'professional_services_advisory',
  'Trades / Field Services': 'trade_field_services',
  'Other': 'general_business'
};
const SENSITIVE_DETAIL_WARNING = 'For this first intake, general ranges and directional examples are enough. Please avoid private financials, recipes, customer names, supplier contracts, payroll details, invoices, or confidential formulas.';
const FULL_MAX_ADAPTIVE_PROBES = 5;
const SNAPSHOT_MAX_ADAPTIVE_PROBES = 2;
const AFPA_MAX_ADAPTIVE_PROBES = 5;
const QUESTION_PRIORITY_WEIGHTS = {
  'Member Profile|Business Context': 5,
  'Repeated Work|Top Repeated Task': 5,
  'Workflow Friction|Current Process': 5,
  'Workflow Friction|Bottleneck': 5,
  'Information Readiness|Information Sources': 5,
  'Risk & Adoption|Human Review Boundary': 5,
  'Revenue Engine|First Useful Win': 5,
  'AI Opportunity|Practical Leverage': 5,
  'Repeated Work|Time & Frequency': 4,
  'Information Readiness|Readiness Assets': 4,
  'AI Opportunity|Comfort Boundary': 4,
  'Member Profile|Team & Role': 3
};
const APPROVED_PROBE_TYPES = ['clarify', 'prioritize', 'range', 'severity', 'frequency', 'blocker', 'owner/readiness', 'risk', 'low-risk pilot', 'voice/tone'];
const FORBIDDEN_PROBE_PATTERNS = [
  /\bexact\b/i,
  /\brevenue\b.*\bamount\b/i,
  /\bprofit\b|\bmargin\b|\bpayroll\b|\bbank\b|\btax\b|\blegal record\b/i,
  /\bcustomer names?\b|\bname your customers?\b|\bnamed customers?\b/i,
  /\bsupplier names?\b|\bname your suppliers?\b|\bnamed suppliers?\b/i,
  /\bemployee personal\b|\bstaff personal\b/i,
  /\brecipe\b|\bformula\b|\bconfidential formula\b/i,
  /\bcontract\b|\binvoice\b|\bpurchase order\b|\bPOs?\b/i,
  /\bpassword\b|\bapi key\b|\bsecret key\b/i,
  /\bhealth\b|\bmedical\b/i
];

// -- Questions --------------------------------------------------------------
// section: 'business' = 8-domain questions (eligible for AI probing at domain end)
// section: 'mastery'  = owner self-assessment (fixed AI-future follow-up, no probing)
const FULL_QUESTIONS = [
  // ==== DOMAIN 1: Business Model & Direction ====
  { section: 'business', domain: 'Business Model & Direction', type: 'Current Reality',
    text: 'How does your business make money today?',
    hint: 'Your core products or services, who pays for them, and whether the money is one-time, recurring, or project-based.' },
  { section: 'business', domain: 'Business Model & Direction', type: 'Pain & Cost',
    text: 'Where is growth stuck, unpredictable, or slower than you want?',
    hint: 'What priorities keep getting ignored because there isn\'t enough time, money, or bandwidth?' },
  { section: 'business', domain: 'Business Model & Direction', type: 'Desired Future',
    text: 'What does success look like 12 months from now?',
    hint: 'Revenue, customers, reach, product mix - paint the picture of where you want to be.' },
  { section: 'business', domain: 'Business Model & Direction', type: 'AI Fit',
    text: 'Which parts of your business run on manual knowledge work that eats your time?',
    hint: 'Reporting, forecasting, writing proposals, research - the thinking-and-typing work behind the scenes.' },

  // ==== DOMAIN 2: Customer Reality ====
  { section: 'business', domain: 'Customer Reality', type: 'Current Reality',
    text: 'Describe your best customers - who are they and why do they choose you?',
    hint: 'Think of 2 or 3 clients you love working with. What do they have in common?' },
  { section: 'business', domain: 'Customer Reality', type: 'Pain & Cost',
    text: 'What do customers complain about most, and where do relationships break down?',
    hint: 'Where do accounts churn, go quiet, or get frustrated?' },
  { section: 'business', domain: 'Customer Reality', type: 'Desired Future',
    text: 'What would a best-in-class customer experience look like for your business?',
    hint: 'What would make clients stay longer, spend more, and refer you without being asked?' },
  { section: 'business', domain: 'Customer Reality', type: 'AI Fit',
    text: 'Which customer touchpoints are slow, repetitive, or inconsistent?',
    hint: 'Responses, follow-ups, updates, onboarding - where could faster or more personal help win loyalty?' },

  // ==== DOMAIN 3: Revenue Engine ====
  { section: 'business', domain: 'Revenue Engine', type: 'Current Reality',
    text: 'Walk through what happens from first contact to signed deal.',
    hint: 'How leads arrive, the first conversation, the proposal, how pricing is set and communicated.' },
  { section: 'business', domain: 'Revenue Engine', type: 'Revenue Opportunity',
    text: 'When you think about new revenue, which type of opportunity would matter most right now, and how would you describe its value without sharing exact numbers?',
    hint: 'Examples: more small repeat customers, larger accounts, online or direct orders, catering or special orders, repeat purchases, higher-value contracts, partnerships, or a new market. For value, use language like small but steady, meaningful weekly revenue, meaningful monthly revenue, capacity-changing, hiring/system-justifying, not sure, or better discussed privately later.' },
  { section: 'business', domain: 'Revenue Engine', type: 'Pain & Cost',
    text: 'Where do deals stall, leak, or fall through the cracks?',
    hint: 'What follow-up gets dropped? Where does the sales process lose people?' },
  { section: 'business', domain: 'Revenue Engine', type: 'Desired Future',
    text: 'What would a more predictable, consistent sales process look like?',
    hint: 'If leads and follow-up just happened reliably, what would change?' },
  { section: 'business', domain: 'Revenue Engine', type: 'AI Fit',
    text: 'Which parts of selling are information-heavy and repeatable?',
    hint: 'Proposals, prospect research, objection responses, CRM updates, follow-up sequences.' },

  // ==== DOMAIN 4: Operations & Delivery ====
  { section: 'business', domain: 'Operations & Delivery', type: 'Current Reality',
    text: 'After a client says yes, how does the work actually get done?',
    hint: 'Step by step - who does what, in what order, and where the handoffs are.' },
  { section: 'business', domain: 'Operations & Delivery', type: 'Pain & Cost',
    text: 'Where does delivery slow down, require rework, or blow past budget or timeline?',
    hint: 'What recurring tasks eat the most time? Where do things most often go wrong?' },
  { section: 'business', domain: 'Operations & Delivery', type: 'Desired Future',
    text: 'What would smoother, faster, more consistent delivery look like?',
    hint: 'If the same quality came out in half the time, what would have to be true?' },
  { section: 'business', domain: 'Operations & Delivery', type: 'AI Fit',
    text: 'Which delivery tasks involve gathering info, writing documents, or checking for errors?',
    hint: 'The coordinating, drafting, and double-checking work that happens on every job.' },

  // ==== DOMAIN 5: People & Decision-Making ====
  { section: 'business', domain: 'People & Decision-Making', type: 'Current Reality',
    text: 'Who are your key people, and what would break if one of them left?',
    hint: 'What knowledge or decisions live in one person\'s head - including yours?' },
  { section: 'business', domain: 'People & Decision-Making', type: 'Pain & Cost',
    text: 'Where do decisions bottleneck or wait on you?',
    hint: 'What can\'t move forward until you personally approve it or figure it out?' },
  { section: 'business', domain: 'People & Decision-Making', type: 'Desired Future',
    text: 'What would it look like if the team could operate more independently?',
    hint: 'Where could documented systems replace knowledge that\'s stuck in people\'s heads?' },
  { section: 'business', domain: 'People & Decision-Making', type: 'AI Fit',
    text: 'Which decisions or communications depend on one person\'s knowledge that tools could support?',
    hint: 'The judgment calls and replies that only happen when a specific person is available.' },

  // ==== DOMAIN 6: Information, Data & Systems ====
  { section: 'business', domain: 'Information & Systems', type: 'Current Reality',
    text: 'Where does the important information in your business actually live?',
    hint: 'Client details, job history, finances, communications - across which tools, files, and people.' },
  { section: 'business', domain: 'Information & Systems', type: 'Pain & Cost',
    text: 'Where is data incomplete, duplicated, or hard to find when you need it?',
    hint: 'Where are you confident, where are you working from rough ranges, and where are you mostly guessing?' },
  { section: 'business', domain: 'Information & Systems', type: 'Desired Future',
    text: 'What would "one source of truth" look like for your business?',
    hint: 'If you opened one dashboard tomorrow, what would you want to see on it?' },
  { section: 'business', domain: 'Information & Systems', type: 'AI Fit',
    text: 'Which reports, summaries, or updates require manual pulling and formatting today?',
    hint: 'The status updates and recaps someone has to assemble by hand every week.' },

  // ==== DOMAIN 7: AI Opportunity & Readiness ====
  { section: 'business', domain: 'AI Opportunity', type: 'Current Reality',
    text: 'What tasks get done over and over, often from scratch?',
    hint: 'Where does the most time go on low-value, repetitive work each week?' },
  { section: 'business', domain: 'AI Opportunity', type: 'Pain & Cost',
    text: 'Which repetitive tasks create the most frustration or delay?',
    hint: 'What would 10 hours a week of saved time actually make possible for you?' },
  { section: 'business', domain: 'AI Opportunity', type: 'Desired Future',
    text: 'If AI handled the most repetitive 20% of work perfectly, what would you focus on instead?',
    hint: 'The higher-value work you never get to because the busywork crowds it out.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Commercial Objective',
    text: 'Is the primary goal of this AI project to reduce operational workload, expand capacity for new revenue, or both?',
    hint: 'This helps separate personal time savings, admin efficiency, and growth capacity without asking for confidential financial detail.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Execution Reality',
    text: 'Let\'s get specific: if we freed up 10-15 hours per week, walk me through exactly what you\'d do with that time. What specific revenue-generating or high-value activities?',
    hint: 'Be concrete without sharing private figures: which channel, customer type, workflow, or growth activity would get your attention first?' },
  { section: 'business', domain: 'AI Opportunity', type: 'Execution Reality',
    text: 'When you commit to new work or goals for your business, what typically happens? Do they get done, get delayed, or get dropped?',
    hint: 'Look back at the last 3-4 goals you set. Did you complete them, or did other things take priority?' },
  { section: 'business', domain: 'AI Opportunity', type: 'AI Fit',
    text: 'Which tasks involve reading, writing, summarizing, or researching - done many times a week?',
    hint: 'The language-and-information work that repeats constantly.' },

  // ==== DOMAIN 8: Risk, Constraints & Adoption ====
  { section: 'business', domain: 'Risk & Adoption', type: 'Current Reality',
    text: 'What privacy, compliance, or confidentiality constraints apply to your business?',
    hint: 'Client data, regulated information, industry rules - and how comfortable your team is with new tech.' },
  { section: 'business', domain: 'Risk & Adoption', type: 'Pain & Cost',
    text: 'What has blocked new technology from sticking in the past?',
    hint: 'Where does fear of error, cost, or disruption create hesitation?' },
  { section: 'business', domain: 'Risk & Adoption', type: 'Desired Future',
    text: 'What would a successful AI rollout look and feel like for your team?',
    hint: 'What would change, and how would the people around you feel about it?' },
  { section: 'business', domain: 'Risk & Adoption', type: 'AI Fit',
    text: 'Which low-risk, reversible AI uses could you try first to build confidence?',
    hint: 'Something easy to pilot and easy to undo, with no sensitive data exposed.' },

  // ==== SECTION 9: OWNER MASTERY (6 categories, two-part) ====
  { section: 'mastery', domain: 'Personal Productivity & Mastery',
    text: 'Where are you right now with personal productivity and mastery?',
    hint: 'This might mean focus, energy, how you structure your days, the systems you rely on, how on-top-of-things you feel - or whatever it means to you.' },
  { section: 'mastery', domain: 'Strategy & Decision-Making',
    text: 'Where are you right now with strategy and decision-making?',
    hint: 'This might mean clarity of direction, how confidently you choose, how often you second-guess, how you weigh options - interpret it your own way.' },
  { section: 'mastery', domain: 'Time & Leverage',
    text: 'Where are you right now with time and leverage?',
    hint: 'Leverage could mean leveraging your time, your money, your people, your tools, your reputation - wherever a little effort creates a lot of output for you.' },
  { section: 'mastery', domain: 'Sales & Influence',
    text: 'Where are you right now with sales and influence?',
    hint: 'This might mean closing deals, persuading a room, building trust, negotiating, or simply getting people to say yes - whatever influence means in your world.' },
  { section: 'mastery', domain: 'Marketing & Messaging',
    text: 'Where are you right now with marketing and messaging?',
    hint: 'This might mean how clearly you explain what you do, your visibility, your brand, your content, how well people "get it" - your call on what counts.' },
  { section: 'mastery', domain: 'Operations & Efficiency',
    text: 'Where are you right now with operations and efficiency?',
    hint: 'Efficiency might be about operations, or it might be about time, money, or energy somewhere else entirely. Take it wherever it fits for you.' }
];

const AFPA_DECEMBER_AI_COURSE_QUESTIONS = [
  { section: 'business', domain: 'Member Profile', type: 'Business Context',
    text: 'What does your food or beverage business do, and what kind of products, services, or customers matter most right now?',
    hint: 'Keep this general. Product categories, channels, customer types, and current priorities are useful. Do not share private recipes, formulas, customer lists, contracts, or confidential financial details.' },
  { section: 'business', domain: 'Member Profile', type: 'Team & Role',
    text: 'Who on your team would most likely use AI first, and what role do they play in the business?',
    hint: 'Use roles, not names: owner, admin, sales, production, QA, marketing, finance, operations, manager, or another role.' },
  { section: 'business', domain: 'Repeated Work', type: 'Top Repeated Task',
    text: 'What repeated admin, sales, production, compliance, customer, or reporting task would be most useful to make easier?',
    hint: 'Think about the work that comes back every week or every month and takes attention away from higher-value work.' },
  { section: 'business', domain: 'Repeated Work', type: 'Time & Frequency',
    text: 'How often does that work happen, and roughly how much time or frustration does it create?',
    hint: 'Daily, weekly, monthly, seasonal, or only when something goes wrong. General ranges are enough.' },
  { section: 'business', domain: 'Workflow Friction', type: 'Current Process',
    text: 'How is that work handled today from start to finish?',
    hint: 'Who starts it, what information they need, where it lives, and where the handoffs or delays happen.' },
  { section: 'business', domain: 'Workflow Friction', type: 'Bottleneck',
    text: 'Where does the work usually slow down, get repeated, need retyping, need checking, or wait for someone?',
    hint: 'This helps AFPA understand what practical examples would make AI training feel useful instead of theoretical.' },
  { section: 'business', domain: 'Information Readiness', type: 'Information Sources',
    text: 'Where does the information for this work usually live?',
    hint: 'Examples: email, spreadsheets, accounting software, ERP, shared folders, labels, spec sheets, SOPs, paper forms, supplier documents, photos, or people\'s memory.' },
  { section: 'business', domain: 'Information Readiness', type: 'Useful Materials',
    text: 'Do you already have examples, templates, checklists, forms, SOPs, spreadsheets, or emails that show how this work should be done?',
    hint: 'A yes, no, or partial answer is fine. This helps identify whether members need AI training, document cleanup, or both.' },
  { section: 'business', domain: 'AI Training Needs', type: 'Most Useful Training',
    text: 'What kind of AI training would be most useful to your team in the next 90 days?',
    hint: 'Examples: prompting basics, safe data handling, admin automation, spreadsheet/report help, customer replies, sales follow-up, production planning, quality/compliance support, marketing, or workflow mapping.' },
  { section: 'business', domain: 'AI Training Needs', type: 'Business Area',
    text: 'Which business area would you most want practical AI examples for?',
    hint: 'Choose the area that would make training immediately useful: admin, sales, marketing, production, QA/compliance, customer service, HR/training, purchasing, finance/reporting, planning, or another area.' },
  { section: 'business', domain: 'AI Training Needs', type: 'Training Format',
    text: 'What training format would be easiest for your business to act on?',
    hint: 'Examples: live workshop, short videos, templates, checklists, industry examples, one-on-one help, done-with-you setup, peer examples, or office-hours support.' },
  { section: 'business', domain: 'Risk & Boundaries', type: 'Comfort Boundary',
    text: 'What would your team be comfortable letting AI help with first?',
    hint: 'Drafting, organizing, summarizing, checking, reminding, searching, reporting, comparing options, or creating first drafts for human review.' },
  { section: 'business', domain: 'Risk & Boundaries', type: 'Do Not Automate',
    text: 'What should AI not touch or decide without a person reviewing it?',
    hint: 'Think customer promises, food safety, compliance, pricing, payroll, confidential formulas, recipes, contracts, private financials, regulated data, or anything high-risk.' },
  { section: 'business', domain: 'Risk & Boundaries', type: 'Training Concerns',
    text: 'What would make your team nervous about using AI in the business?',
    hint: 'Accuracy, privacy, staff adoption, cost, security, misinformation, losing control, confusing tools, regulatory concerns, or not knowing where to start.' },
  { section: 'business', domain: 'Readiness & Adoption', type: 'Current AI Use',
    text: 'How is your business using AI today, if at all?',
    hint: 'Not using it yet, experimenting personally, using it in one department, using it inconsistently, or already using it in regular workflows.' },
  { section: 'business', domain: 'Readiness & Adoption', type: 'What Would Help',
    text: 'What would make AI feel safe, practical, and worth using for your team?',
    hint: 'Examples: approved examples, clear privacy rules, templates, checklists, human review steps, starter workflows, training for staff, or help choosing tools.' },
  { section: 'business', domain: 'First Useful Win', type: 'Member Value',
    text: 'If one AI-supported workflow worked well for your business, what would improve first?',
    hint: 'Time saved, fewer errors, faster follow-up, better documentation, clearer planning, improved customer response, more consistent training, or reduced stress.' },
  { section: 'business', domain: 'AFPA Course Design', type: 'Success Signal',
    text: 'What would make an AFPA AI training session feel like a real win for your business?',
    hint: 'Tell us what you would want to leave with: a working template, a mapped workflow, a better prompt, a privacy checklist, a draft automation idea, a safer AI policy, or a clear first step.' },
  { section: 'business', domain: 'Niche Fit', type: 'Industry Example',
    text: 'What is one common problem, customer question, or internal task that is specific to your niche?',
    hint: 'Examples might involve shelf life, labeling, cold chain, buyer follow-up, quality records, production planning, distributor updates, or another issue common in your part of food processing. Keep it general.' },
  { section: 'business', domain: 'Niche Fit', type: 'Useful Template',
    text: 'If AFPA provided one AI-ready template or example for businesses like yours, what would you want it to help with first?',
    hint: 'Think about a checklist, email draft, SOP helper, reporting template, training guide, buyer follow-up, production-planning prompt, quality-note summary, or another practical tool.' }
];

const SNAPSHOT_QUESTIONS = [
  { section: 'business', domain: 'Business Model & Direction', type: 'Business Snapshot',
    text: 'Who do you serve, and what work, product, or service matters most right now?',
    hint: 'A simple overview is enough: what you sell or deliver, who buys it, and where the business is trying to grow or stabilize.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Top Bottleneck',
    text: 'What is the most frustrating repeated task or process in the business right now?',
    hint: 'The thing that keeps coming back, slows people down, causes stress, or gets handled manually too often.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Frequency',
    text: 'How often does this come up: daily, weekly, monthly, seasonal, or mostly when things go wrong?',
    hint: 'Frequency helps separate a nice-to-have automation from something that could create real operational relief.' },
  { section: 'business', domain: 'Operations & Delivery', type: 'Current Workaround',
    text: 'How do you handle that work today?',
    hint: 'Who starts it, what tools or notes they use, and what workaround keeps it moving.' },
  { section: 'business', domain: 'Operations & Delivery', type: 'Handoff & Delay Point',
    text: 'Where does it usually slow down, get repeated, or need clarification?',
    hint: 'Look for waiting, retyping, rechecking, missing information, unclear ownership, or repeated back-and-forth.' },
  { section: 'business', domain: 'People & Decision-Making', type: 'Who Is Involved',
    text: 'Who usually touches this work before it is finished?',
    hint: 'Use roles, not names: owner, admin, sales, production, bookkeeper, manager, customer, supplier, or outside partner.' },
  { section: 'business', domain: 'Information & Systems', type: 'Information Location',
    text: 'Where does the information needed for this work usually live?',
    hint: 'Examples: memory, email, spreadsheets, software, paper forms, shared folders, phone photos, notes, or a mix of places.' },
  { section: 'business', domain: 'Information & Systems', type: 'Readiness Assets',
    text: 'Do you already have examples, templates, checklists, emails, forms, SOPs, or spreadsheets that show how this work should be done?',
    hint: 'A yes, no, or partial answer is fine. This helps us know whether AI could learn from existing material or whether cleanup comes first.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Comfort Boundary',
    text: 'What would you be comfortable letting AI help with first?',
    hint: 'Drafting, organizing, summarizing, checking, reminding, analyzing, recommending, searching, reporting, or something else.' },
  { section: 'business', domain: 'Risk & Adoption', type: 'Human Review Boundary',
    text: 'What should AI absolutely not touch or decide without a person reviewing it?',
    hint: 'Think approvals, customer promises, pricing, private data, compliance, safety, payroll, formulas, contracts, or anything sensitive.' },
  { section: 'business', domain: 'Revenue Engine', type: 'First Useful Win',
    text: 'If this got 20 percent easier, what would improve first?',
    hint: 'Time, consistency, customer response, sales follow-up, fewer mistakes, less stress, faster decisions, or capacity for better work.' },
  { section: 'business', domain: 'AI Opportunity', type: 'Practical Leverage',
    text: 'If AI took one frustrating or repetitive thing off your plate, what would you spend more time or attention on instead?',
    hint: 'Keep it practical: serving customers, sales, production, planning, training, quality, marketing, family time, or getting control back.' }
];
const SNAPSHOT_QUESTION_KEYS = new Set(SNAPSHOT_QUESTIONS.map(questionKey));
let QUESTIONS = FULL_QUESTIONS;

// Fixed follow-up shown after every mastery question
const MASTERY_FOLLOWUP = 'And if AI quietly handled this area for you, what would that free you up to do, or how would it change things?';
const SESSION_KEY = 'bridge-to-ai-intake-session-v1';
const DRAFT_ACCESS_KEY = 'bridge-to-ai-intake-access-v1';
const LEGACY_DRAFT_KEY = 'bridge-to-ai-intake-draft-v1';

// State ------------------------------------------------------------------
let currentQ = 0;
let answers = [];              // base answer per question index
let masteryFollowups = [];     // mastery follow-up answer per question index (only mastery uses it)
let masteryFollowupQ = [];     // the follow-up QUESTION shown for each mastery item (smart or generic)
let domainProbes = {};         // { probeKey: { domain, sourceQuestionIndex, question, answer } }
let snapshotAnswersArchive = []; // preserved Snapshot First answers if the user continues deeper
// Voice & Standards scenario (near the start, tailored to business category)
let scenarioText = '';         // the AI-generated scenario the client reacts to
let scenarioGood = '';         // their "best/proud" reply
let scenarioBad = '';          // their "bad/off-brand" reply
let scenarioStage = null;      // null | 'good' | 'bad' - which beat is showing
let scenarioDone = false;      // true once both beats are captured
let clientName = '';
let clientEmail = '';
let privacyConsent = false;
let privacyConsentAt = '';
let btaiFollowupInterest = 'maybe';
let btaiFollowupInterestAt = '';
let freeReportDeliveryStarted = false;
let freeReportDeliverySucceeded = false;
let completionTestMode = false;
let businessName = '';
let businessCategory = '';
let businessNiche = '';
let shareComfort = 'Directional only';
let websiteUrl = '';
let companySize = '';
let ownerWorkStatus = '';
let departments = [];
let businessContext = null;
let campaignPartner = CONFIG.DEFAULT_PARTNER;
let campaignId = CONFIG.DEFAULT_CAMPAIGN;
let partnerDisplayName = '';
let intakeVariant = 'full_diagnostic';
let recognition = null;
let isRecording = false;
let recognitionSessionId = 0;

// Sub-step within a question: 'main' = base question, 'followup' = mastery AI-future Q, 'probe' = AI probe
let subStep = 'main';
let activeProbe = null;        // { key, domain, sourceQuestionIndex, question } when a probe is showing
let draftAutosaveEnabled = true;
let clientDraftId = '';
let draftAccessToken = '';
const interviewIdentity = () => ({ clientName, clientEmail, businessName, websiteUrl, declaredPeople: [] });
let lastLoggedQuestionKey = '';
let loggedSectionStarts = {};
let loggedSectionCompletes = {};
let sectionStartTimes = {};
let interviewStartedAtMs = null;
let interviewSubmitted = false;
let lastAbandonmentLogAt = 0;
let pendingDraftPayload = null;
let draftSaveTimer = null;
let lastLoadedDraft = null;
let lastSecureStorage = null;

// -- Screen management ------------------------------------------------------
function ensureClientDraftId() {
  if (!draftAccessToken) {
    try { draftAccessToken = localStorage.getItem(DRAFT_ACCESS_KEY) || ''; } catch (e) { /* session resume unavailable */ }
  }
  if (!clientDraftId) {
    try { clientDraftId = localStorage.getItem(SESSION_KEY) || ''; } catch (e) { /* ignore */ }
  }
  if (!clientDraftId) {
    clientDraftId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  try { localStorage.setItem(SESSION_KEY, clientDraftId); } catch (e) { /* session resume unavailable */ }
  return clientDraftId;
}

function countWords(text) {
  const cleaned = String(text || '').trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function safeMetricLabel(value, fallback = '') {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function initCampaignContext() {
  const params = new URLSearchParams(window.location.search);
  const path = String(window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
  const pathCampaign =
    path === '/snapshot' || path === '/snapshot-first' ? 'snapshot_first' :
    path === '/afpa' ? 'afpa_member_intake' :
    path === '/full' ? 'full_diagnostic' :
    '';
  campaignPartner = safeMetricLabel(params.get('partner'), path === '/afpa' ? 'AFPA' : CONFIG.DEFAULT_PARTNER) || CONFIG.DEFAULT_PARTNER;
  const partnerDefaultCampaign = String(campaignPartner || '').toUpperCase() === 'AFPA' ? 'afpa_member_intake' : CONFIG.DEFAULT_CAMPAIGN;
  campaignId = safeMetricLabel(params.get('campaign'), pathCampaign || partnerDefaultCampaign) || CONFIG.DEFAULT_CAMPAIGN;
  partnerDisplayName = activePartnerProfile()?.displayName || '';
  intakeVariant = activeIntakeVariant();
  applyCampaignQuestionSet();
  applyPartnerBranding();
}

function activePartnerProfile() {
  return PARTNER_PROFILES[String(campaignPartner || '').toUpperCase()] || null;
}

function activeIntakeVariant() {
  const normalizedCampaign = String(campaignId || '').toLowerCase();
  const path = String(window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
  if (
    path === '/snapshot' ||
    path === '/snapshot-first' ||
    normalizedCampaign === 'snapshot_first' ||
    normalizedCampaign === 'snapshot-first' ||
    normalizedCampaign === 'afpa_snapshot' ||
    normalizedCampaign === 'afpa_snapshot_first' ||
    normalizedCampaign === 'member_snapshot'
  ) {
    return 'snapshot_first';
  }
  if (
    path === '/afpa' ||
    normalizedCampaign === 'afpa' ||
    normalizedCampaign === 'afpa_member_intake' ||
    normalizedCampaign === 'afpa_december_ai_course_2026'
  ) {
    return 'afpa_member_intake';
  }
  return 'full_diagnostic';
}

function isSnapshotFirstCampaign() {
  return intakeVariant === 'snapshot_first';
}

function isAfpaMemberIntake() {
  return intakeVariant === 'afpa_member_intake';
}

function isAfpaDecemberAiCourseCampaign() {
  return (
    String(campaignPartner || '').toUpperCase() === 'AFPA' &&
    String(campaignId || '').toLowerCase() === 'afpa_december_ai_course_2026' &&
    isAfpaMemberIntake()
  );
}

function isContinuedDeepDiagnostic() {
  return intakeVariant === 'full_diagnostic_continued';
}

function activeScenarioStepCount() {
  return intakeVariant === 'full_diagnostic' ? 2 : 0;
}

function activeQuestionSetName() {
  if (isSnapshotFirstCampaign()) return 'snapshot_first_short_set';
  if (isAfpaMemberIntake()) return 'afpa_member_20_question_set';
  return 'full_diagnostic_set';
}

function questionKey(q) {
  return `${q.section || ''}|${q.domain || ''}|${q.type || ''}`;
}

function applyCampaignQuestionSet() {
  QUESTIONS = isSnapshotFirstCampaign()
    ? SNAPSHOT_QUESTIONS
    : isAfpaMemberIntake()
      ? AFPA_DECEMBER_AI_COURSE_QUESTIONS
      : FULL_QUESTIONS;
  if (Number.isInteger(currentQ)) currentQ = clampQuestionIndex(currentQ);
}

function firstUnansweredFullQuestionIndex(nextAnswers) {
  const index = FULL_QUESTIONS.findIndex((q, i) => {
    if (SNAPSHOT_QUESTION_KEYS.has(questionKey(q))) return false;
    return !String(nextAnswers[i] || '').trim();
  });
  return index === -1 ? FULL_QUESTIONS.length - 1 : index;
}

function mapCurrentAnswersToFullQuestionSet() {
  const snapshotQuestions = Array.isArray(QUESTIONS) ? QUESTIONS : [];
  snapshotAnswersArchive = snapshotQuestions.map((q, index) => ({
    domain: q.domain || '',
    type: q.type || '',
    question: q.text || '',
    answer: answers[index] || ''
  })).filter(item => String(item.answer || '').trim());
  const answerBuckets = new Map();
  const followupBuckets = new Map();
  const followupQuestionBuckets = new Map();

  snapshotQuestions.forEach((q, index) => {
    const key = questionKey(q);
    if (!answerBuckets.has(key)) {
      answerBuckets.set(key, []);
      followupBuckets.set(key, []);
      followupQuestionBuckets.set(key, []);
    }
    answerBuckets.get(key).push(answers[index] || '');
    followupBuckets.get(key).push(masteryFollowups[index] || '');
    followupQuestionBuckets.get(key).push(masteryFollowupQ[index] || '');
  });

  const nextAnswers = new Array(FULL_QUESTIONS.length).fill('');
  const nextMasteryFollowups = new Array(FULL_QUESTIONS.length).fill('');
  const nextMasteryFollowupQ = new Array(FULL_QUESTIONS.length).fill('');

  FULL_QUESTIONS.forEach((q, index) => {
    const key = questionKey(q);
    nextAnswers[index] = (answerBuckets.get(key) || []).shift() || '';
    nextMasteryFollowups[index] = (followupBuckets.get(key) || []).shift() || '';
    nextMasteryFollowupQ[index] = (followupQuestionBuckets.get(key) || []).shift() || '';
  });

  answers = nextAnswers;
  masteryFollowups = nextMasteryFollowups;
  masteryFollowupQ = nextMasteryFollowupQ;
}

function activeMaxAdaptiveProbes() {
  if (isAfpaMemberIntake()) return AFPA_MAX_ADAPTIVE_PROBES;
  return isSnapshotFirstCampaign() ? SNAPSHOT_MAX_ADAPTIVE_PROBES : FULL_MAX_ADAPTIVE_PROBES;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.innerHTML = value;
}

function applyPartnerBranding() {
  const profile = activePartnerProfile();
  const banner = document.getElementById('partner-banner');
  const partnerLogoCard = document.getElementById('partner-logo-card');
  const partnerLogoImg = document.getElementById('partner-logo-img');
  const partnerHeaderLogo = document.getElementById('partner-header-logo');
  const partnerHeaderLogoImg = document.getElementById('partner-header-logo-img');
  const partnerConsent = document.getElementById('partner-consent-note');
  const whiteLabelNote = document.getElementById('white-label-note');
  document.body.classList.toggle('campaign-afpa-course', isAfpaDecemberAiCourseCampaign());
  if (!profile) {
    if (banner) banner.classList.remove('active');
    if (partnerLogoCard) partnerLogoCard.classList.remove('active');
    if (partnerHeaderLogo) partnerHeaderLogo.classList.remove('active');
    if (partnerConsent) partnerConsent.classList.remove('active');
    if (whiteLabelNote) whiteLabelNote.classList.remove('hidden');
    setText('header-tag', 'Business Discovery Session');
    applyCampaignCopy();
    return;
  }

  setText('header-tag', profile.headerTag);
  setText('partner-pill', profile.pill);
  setText('partner-banner-text', profile.banner);
  setText('welcome-eyebrow', profile.eyebrow);
  setHtml('welcome-headline', profile.headline);
  setText('welcome-body', profile.body);
  setText('step-one-text', profile.stepOne);
  setText('step-four-text', profile.stepFour);
  if (profile.logoSrc) {
    if (partnerLogoImg) {
      partnerLogoImg.src = profile.logoSrc;
      partnerLogoImg.alt = profile.logoAlt || profile.displayName || '';
    }
    if (partnerHeaderLogoImg) {
      partnerHeaderLogoImg.src = profile.logoSrc;
      partnerHeaderLogoImg.alt = profile.logoAlt || profile.displayName || '';
    }
    if (partnerLogoCard) partnerLogoCard.classList.add('active');
    if (partnerHeaderLogo) partnerHeaderLogo.classList.add('active');
  } else {
    if (partnerLogoCard) partnerLogoCard.classList.remove('active');
    if (partnerHeaderLogo) partnerHeaderLogo.classList.remove('active');
  }
  if (Array.isArray(profile.nextSteps)) {
    profile.nextSteps.forEach((step, index) => {
      setText(`next-title-${index + 1}`, step[0]);
      setText(`next-desc-${index + 1}`, step[1]);
    });
  }
  if (banner) banner.classList.add('active');
  if (partnerConsent) partnerConsent.classList.add('active');
  if (whiteLabelNote) whiteLabelNote.classList.add('hidden');
  configureAfpaCourseFrontDoor();
}

function answerQuality(text) {
  const wordCount = countWords(text);
  let bucket = 'empty';
  if (wordCount >= 60) bucket = 'rich';
  else if (wordCount >= 25) bucket = 'useful';
  else if (wordCount >= 12) bucket = 'light';
  else if (wordCount >= 6) bucket = 'short';
  else if (wordCount > 0) bucket = 'minimal';

  return {
    wordCount,
    bucket,
    isShortAnswer: wordCount > 0 && wordCount < 12,
    hasNumber: /\d/.test(String(text || '')),
    hasExampleLanguage: /\b(example|for instance|usually|often|when|because|customer|client|order|job|week|month|hours?)\b/i.test(String(text || ''))
  };
}

function allAnswerTexts() {
  const probeAnswers = Object.values(domainProbes || {}).map(probe => probe?.answer || '');
  return [
    scenarioGood,
    scenarioBad,
    ...answers,
    ...masteryFollowups,
    ...probeAnswers
  ].filter(text => String(text || '').trim());
}

function questionProbeKey(qIndex = currentQ) {
  const q = QUESTIONS[qIndex] || {};
  return `${q.domain || 'Question'}|${q.type || 'Question'}|${qIndex}`;
}

function probeEntriesForDomain(domainName) {
  return Object.values(domainProbes || {}).filter(probe => probe && probe.domain === domainName);
}

function probeEntriesForQuestion(qIndex) {
  return Object.values(domainProbes || {}).filter(probe => probe && probe.sourceQuestionIndex === qIndex);
}

function questionPriorityWeight(q = {}) {
  const explicit = QUESTION_PRIORITY_WEIGHTS[`${q.domain || ''}|${q.type || ''}`];
  if (Number.isFinite(explicit)) return explicit;
  if (/risk|boundary|do not|privacy|compliance/i.test(`${q.domain || ''} ${q.type || ''} ${q.text || ''}`)) return 5;
  if (/process|bottleneck|repeated|frequency|source|readiness|first useful|leverage/i.test(`${q.domain || ''} ${q.type || ''} ${q.text || ''}`)) return 4;
  if (q.section === 'business') return 3;
  return 2;
}

function adaptiveRedirectDecision(q = {}, answer = '') {
  const priorityWeight = questionPriorityWeight(q);
  const quality = answerQuality(answer);
  const hasEnoughShape = quality.hasExampleLanguage || quality.hasNumber;
  let needsRedirect = false;
  let reason = '';

  if (quality.wordCount > 0 && quality.wordCount < 6) {
    needsRedirect = true;
    reason = 'minimal_answer';
  } else if (priorityWeight >= 5 && quality.wordCount < 18) {
    needsRedirect = true;
    reason = 'high_priority_thin_answer';
  } else if (priorityWeight >= 4 && quality.wordCount < 14) {
    needsRedirect = true;
    reason = 'important_thin_answer';
  } else if (priorityWeight >= 4 && quality.wordCount < 30 && !hasEnoughShape) {
    needsRedirect = true;
    reason = 'missing_example_or_range';
  } else if (priorityWeight >= 3 && quality.wordCount < 10) {
    needsRedirect = true;
    reason = 'short_answer';
  }

  return { needsRedirect, reason, priorityWeight, quality };
}

function answeredCoreQuestionCount() {
  let completed = answers.filter(answer => String(answer || '').trim()).length;
  if (activeScenarioStepCount() > 0) {
    if (scenarioGood && scenarioGood.trim()) completed += 1;
    if (scenarioBad && scenarioBad.trim()) completed += 1;
  }
  return completed;
}

function totalCoreQuestionCount() {
  return QUESTIONS.length + activeScenarioStepCount();
}

function progressMetrics(extra = {}) {
  const totalPromptCount = totalCoreQuestionCount();
  const completedPromptCount = answeredCoreQuestionCount();
  return {
    totalPromptCount,
    completedPromptCount,
    completionFraction: totalPromptCount ? Number((completedPromptCount / totalPromptCount).toFixed(3)) : 0,
    completionPercent: totalPromptCount ? Math.round((completedPromptCount / totalPromptCount) * 100) : 0,
    currentPromptNumber: scenarioStage === 'good' ? 1 : scenarioStage === 'bad' ? 2 : currentQ + 1 + activeScenarioStepCount(),
    lastCompletedQuestionIndex: Math.max(-1, answers.reduce((last, answer, index) => String(answer || '').trim() ? index : last, -1)),
    lastCompletedQuestionNumber: Math.max(0, answers.reduce((last, answer, index) => String(answer || '').trim() ? index + 1 : last, 0)),
    generatedProbeCount: generatedProbeCount(),
    answeredProbeCount: Object.values(domainProbes || {}).filter(probe => probe?.answer && countWords(probe.answer) > 0).length,
    ...extra
  };
}
function interviewKpiSummary() {
  const texts = allAnswerTexts();
  const wordCounts = texts.map(text => countWords(text));
  const totalWordCount = wordCounts.reduce((sum, n) => sum + n, 0);
  const shortAnswerCount = wordCounts.filter(n => n > 0 && n < 12).length;
  const richAnswerCount = wordCounts.filter(n => n >= 60).length;
  const probeEntries = Object.values(domainProbes || {});
  const generatedProbeCount = probeEntries.filter(probe => probe?.asked && probe?.question).length;
  const answeredProbeCount = probeEntries.filter(probe => probe?.answer && countWords(probe.answer) > 0).length;
  const elapsedSeconds = interviewStartedAtMs ? Math.round((Date.now() - interviewStartedAtMs) / 1000) : null;

  return {
    baseQuestionCount: QUESTIONS.length,
    answeredPromptCount: texts.length,
    totalWordCount,
    averageWordsPerAnswer: texts.length ? Math.round(totalWordCount / texts.length) : 0,
    shortAnswerCount,
    shortAnswerRate: texts.length ? Number((shortAnswerCount / texts.length).toFixed(3)) : 0,
    richAnswerCount,
    generatedProbeCount,
    answeredProbeCount,
    elapsedSeconds,
    businessNiche,
    shareComfort,
    intakeVariant,
    questionSet: activeQuestionSetName(),
    maxAdaptiveProbes: activeMaxAdaptiveProbes(),
    ...progressMetrics()
  };
}

function currentQuestionMeta() {
  const q = QUESTIONS[currentQ] || {};
  return {
    questionIndex: scenarioStage ? null : currentQ,
    questionType: scenarioStage ? `scenario_${scenarioStage}` : (subStep === 'followup' ? 'mastery_followup' : subStep === 'probe' ? 'domain_probe' : q.type || ''),
    domain: scenarioStage ? 'Voice & Standards' : q.domain || '',
    stage: scenarioStage || subStep || 'main'
  };
}

function logHermesEvent(eventType, status = 'info', details = {}) {
  try {
    readWelcomeFields();
    const meta = currentQuestionMeta();
    const transcriptText = document.getElementById('transcript')?.innerText || '';
    const quality = answerQuality(details.answerTextForMetrics || transcriptText);
    const payload = {
      clientDraftId: ensureClientDraftId(),
      clientName,
      businessName,
      businessCategory,
      businessNiche,
      shareComfort,
      companySize,
      ownerWorkStatus,
      partner: campaignPartner,
      campaign: campaignId,
      intakeVariant,
      eventType,
      status,
      stage: meta.stage,
      questionIndex: meta.questionIndex,
      questionType: meta.questionType,
      domain: meta.domain,
      answerWordCount: quality.wordCount,
      details: {
        partner: campaignPartner,
        campaign: campaignId,
        intakeVariant,
        questionSet: activeQuestionSetName(),
        hasWebsite: !!websiteUrl,
        businessNiche,
        shareComfort,
        departments,
        privacyConsent,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        btaiFollowupInterest,
        answerQualityBucket: quality.bucket,
        isShortAnswer: quality.isShortAnswer,
        hasNumber: quality.hasNumber,
        hasExampleLanguage: quality.hasExampleLanguage,
        ...details
      }
    };
    delete payload.details.answerTextForMetrics;

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/hermes-log', blob)) return;
    }

    fetch('/api/hermes-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch (e) { /* monitoring must never block the interview */ }
}
function hermesSectionKey(sectionType, sectionName) {
  return `${sectionType}:${sectionName || 'unknown'}`;
}

function logHermesSectionStarted(sectionType, sectionName, details = {}) {
  const key = hermesSectionKey(sectionType, sectionName);
  if (loggedSectionStarts[key]) return;
  loggedSectionStarts[key] = true;
  sectionStartTimes[key] = Date.now();
  logHermesEvent(`${sectionType}_started`, 'success', { section: sectionName, ...details });
}

function logHermesSectionCompleted(sectionType, sectionName, details = {}) {
  const key = hermesSectionKey(sectionType, sectionName);
  if (loggedSectionCompletes[key]) return;
  loggedSectionCompletes[key] = true;
  const durationSeconds = sectionStartTimes[key] ? Math.round((Date.now() - sectionStartTimes[key]) / 1000) : null;
  logHermesEvent(`${sectionType}_completed`, 'success', { section: sectionName, durationSeconds, ...details });
}

function domainAnswerStats(domainName) {
  const indexes = QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(x => x.q.section === 'business' && x.q.domain === domainName);
  const baseWords = indexes.reduce((sum, x) => sum + countWords(answers[x.i] || ''), 0);
  const probes = probeEntriesForDomain(domainName);
  const probeWords = probes.reduce((sum, probe) => sum + countWords(probe?.answer || ''), 0);
  return {
    questionCount: indexes.length + probes.filter(probe => probe?.asked && probe?.question).length,
    totalWordCount: baseWords + probeWords
  };
}

function masteryAnswerStats(qIndex) {
  return {
    questionCount: 2,
    totalWordCount: countWords(answers[qIndex] || '') + countWords(masteryFollowups[qIndex] || '')
  };
}
function captureVisibleTranscript() {
  const box = document.getElementById('transcript');
  if (!box) return;
  const val = box.innerText.trim();

  if (scenarioStage === 'good') scenarioGood = val;
  else if (scenarioStage === 'bad') scenarioBad = val;
  else if (subStep === 'followup') masteryFollowups[currentQ] = val;
  else if (subStep === 'probe' && activeProbe) {
    const probeKey = activeProbe.key || activeProbe.domain || questionProbeKey(currentQ);
    if (!domainProbes[probeKey]) domainProbes[probeKey] = { ...activeProbe, answer: '', asked: true };
    domainProbes[probeKey].answer = val;
    domainProbes[probeKey].asked = true;
  } else if (answers.length) {
    answers[currentQ] = val;
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function updateEmailFieldStatus(showEmpty = false) {
  const input = document.getElementById('client-email');
  const status = document.getElementById('client-email-status');
  if (!input || !status) return true;
  const value = normalizeEmail(input.value);
  input.value = value;
  input.classList.remove('field-invalid');
  status.classList.remove('error', 'ok');
  if (!value) {
    status.textContent = showEmpty ? 'Please enter the email address where you want the report sent.' : '';
    if (showEmpty) {
      status.classList.add('error');
      input.classList.add('field-invalid');
    }
    return false;
  }
  if (!isValidEmail(value)) {
    status.textContent = 'That email address looks incomplete. Please check for a missing @, dot, or typo.';
    status.classList.add('error');
    input.classList.add('field-invalid');
    return false;
  }
  status.textContent = 'Looks good. The report will be sent to this address unless you correct it later.';
  status.classList.add('ok');
  return true;
}

function updateCompletionEmailFieldStatus(showMessage = false) {
  const input = document.getElementById('completion-email-input');
  const status = document.getElementById('followup-save-status');
  if (!input) return isValidEmail(clientEmail);
  const value = normalizeEmail(input.value);
  input.value = value;
  if (!value || !isValidEmail(value)) {
    if (status && showMessage) status.textContent = 'Please enter a valid email address before sending the free report.';
    return false;
  }
  clientEmail = value;
  if (status && showMessage) status.textContent = `Ready to send your free report to ${value}.`;
  return true;
}

function readWelcomeFields() {
  clientName = document.getElementById('client-name').value.trim();
  clientEmail = normalizeEmail(document.getElementById('client-email').value);
  privacyConsent = document.getElementById('privacy-consent').checked;
  btaiFollowupInterest = document.querySelector('input[name="btai-followup"]:checked')?.value || btaiFollowupInterest || 'maybe';
  businessName = document.getElementById('business-name').value.trim();
  businessNiche = document.getElementById('business-niche').value.trim();
  // New intakes use one plain-language description. A legacy draft can still
  // carry a separate old category; retain it so its established industry pack
  // does not silently change when the user resumes and saves.
  const legacyCategory = LEGACY_CATEGORY_PACK_MAP[businessCategory] ? businessCategory : '';
  if (!legacyCategory) businessCategory = businessNiche;
  shareComfort = document.getElementById('share-comfort').value.trim() || 'Directional only';
  websiteUrl = document.getElementById('website-url').value.trim();
  companySize = document.getElementById('company-size').value.trim();
  ownerWorkStatus = document.getElementById('owner-work-status').value.trim();
  departments = Array.from(document.querySelectorAll('.dept-pill input:checked')).map(cb => cb.value);
}

function applyWelcomeFields() {
  document.getElementById('client-name').value = clientName || '';
  document.getElementById('client-email').value = clientEmail || '';
  updateEmailFieldStatus(false);
  document.getElementById('privacy-consent').checked = !!privacyConsent;
  const followupInput = document.querySelector(`input[name="btai-followup"][value="${btaiFollowupInterest || 'maybe'}"]`);
  if (followupInput) followupInput.checked = true;
  document.getElementById('business-name').value = businessName || '';
  document.getElementById('business-niche').value = businessNiche || businessCategory || '';
  document.getElementById('share-comfort').value = shareComfort || 'Directional only';
  document.getElementById('website-url').value = websiteUrl || '';
  document.getElementById('company-size').value = companySize || '';
  document.getElementById('owner-work-status').value = ownerWorkStatus || '';
  document.querySelectorAll('.dept-pill input').forEach(cb => { cb.checked = departments.includes(cb.value); });
}

function buildDraftPayload(captureTranscript = true) {
  if (!draftAutosaveEnabled) return;
  readWelcomeFields();
  if (captureTranscript) captureVisibleTranscript();
  return {
    version: 2,
    storageMode: 'server_encrypted_supabase',
    savedAt: new Date().toISOString(),
    clientDraftId: ensureClientDraftId(),
    clientName,
    clientEmail,
    privacyConsent,
    privacyConsentAt,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    btaiFollowupInterest,
    btaiFollowupInterestAt,
    campaignPartner,
    campaignId,
    partnerDisplayName,
    intakeVariant,
    questionSet: activeQuestionSetName(),
    businessName,
    businessCategory,
    businessNiche,
    shareComfort,
    websiteUrl,
    companySize,
    ownerWorkStatus,
    departments,
    currentQ,
    answers,
    masteryFollowups,
    masteryFollowupQ,
    domainProbes,
    snapshotAnswersArchive,
    scenarioText,
    scenarioGood,
    scenarioBad,
    scenarioStage,
    scenarioDone,
    businessContext,
    industryPack: industryPackSummary(),
    subStep,
    activeProbe,
    interviewStarted: scenarioDone || !!scenarioStage || answers.some(Boolean) || masteryFollowups.some(Boolean) || Object.keys(domainProbes).length > 0
  };
}

function postDraftToServer(payload, useBeacon = false) {
  if (!payload || !payload.clientDraftId) return Promise.resolve({ saved: false });
  try { localStorage.setItem(SESSION_KEY, payload.clientDraftId); } catch (e) { /* ignore */ }

  const body = JSON.stringify({ action: 'save', payload, draftAccessToken });
  if (useBeacon && draftAccessToken && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/draft', blob)) return Promise.resolve({ saved: true, queued: true });
    } catch (e) { /* fall through to fetch */ }
  }

  return fetch('/api/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: useBeacon
  }).then(async resp => {
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || 'Draft save failed');
    }
    const data = await resp.json();
    if (data.draftAccessToken) {
      draftAccessToken = data.draftAccessToken;
      try { localStorage.setItem(DRAFT_ACCESS_KEY, draftAccessToken); } catch (e) { /* session resume unavailable */ }
    }
    updateDraftSaveStatus('Your answers are saved. It is safe to refresh this page.', 'ok');
    return data;
  });
}

function updateDraftSaveStatus(message = '', state = '') {
  const status = document.getElementById('draft-save-status');
  if (!status) return;
  status.textContent = message;
  status.className = `draft-save-status${state ? ` ${state}` : ''}`;
}

function flushDraftSave(useBeacon = false) {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }
  const payload = pendingDraftPayload;
  pendingDraftPayload = null;
  if (!payload) return Promise.resolve({ saved: false });
  return postDraftToServer(payload, useBeacon).catch(err => {
    updateDraftSaveStatus('We could not save the latest changes. Please do not refresh yet.', 'error');
    logHermesEvent('autosave_failed', 'failed', { autosaveTarget: 'server_encrypted_supabase', error: err.message || 'Server draft storage unavailable' });
    return { saved: false, error: err.message };
  });
}

function saveDraft(captureTranscript = true, immediate = false) {
  if (!draftAutosaveEnabled) return;
  try {
    const payload = buildDraftPayload(captureTranscript);
    if (!payload) return;
    updateDraftSaveStatus('Saving your answers…', 'saving');
    pendingDraftPayload = payload;
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    if (immediate) flushDraftSave(false);
    else draftSaveTimer = setTimeout(() => flushDraftSave(false), 900);
  } catch (e) { logHermesEvent('autosave_failed', 'failed', { autosaveTarget: 'server_encrypted_supabase', error: e.message || 'Draft preparation failed' }); }
}

async function loadDraft(clientDraftIdOverride = '') {
  let sessionId = '';
  if (clientDraftIdOverride) sessionId = String(clientDraftIdOverride || '').trim();
  else {
    try { sessionId = localStorage.getItem(SESSION_KEY) || ''; } catch (e) { sessionId = ''; }
  }
  if (!draftAccessToken) {
    try { draftAccessToken = localStorage.getItem(DRAFT_ACCESS_KEY) || ''; } catch (e) { /* session resume unavailable */ }
  }
  if (!sessionId) return null;

  try {
    const resp = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', clientDraftId: sessionId, draftAccessToken })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.found ? data.payload : null;
  } catch (e) { return null; }
}

async function maybeContinueDeepInterviewFromLink() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('continue') !== 'deep') return false;
  const recordId = params.get('recordId') || '';
  if (!recordId) return false;

  const draft = await loadDraft(recordId);
  if (!draft) return false;
  try { localStorage.setItem(SESSION_KEY, recordId); } catch (e) { /* resume unavailable */ }
  lastLoadedDraft = { ...draft, clientDraftId: draft.clientDraftId || recordId };
  await resumeSavedInterview({ requireCampaignMatch: false });
  if (isSnapshotFirstCampaign()) {
    continueIntoDeepDiagnostic();
    return true;
  }
  return false;
}

function normalizeCampaignValue(value) {
  return String(value || '').trim().toLowerCase();
}

function draftMatchesCurrentCampaign(draft) {
  if (!draft) return false;
  return (
    normalizeCampaignValue(draft.campaignPartner || CONFIG.DEFAULT_PARTNER) === normalizeCampaignValue(campaignPartner || CONFIG.DEFAULT_PARTNER) &&
    normalizeCampaignValue(draft.campaignId || CONFIG.DEFAULT_CAMPAIGN) === normalizeCampaignValue(campaignId || CONFIG.DEFAULT_CAMPAIGN) &&
    normalizeCampaignValue(draft.intakeVariant || activeIntakeVariant()) === normalizeCampaignValue(intakeVariant || activeIntakeVariant())
  );
}

async function showResumeCardIfNeeded() {
  const draft = await loadDraft();
  const card = document.getElementById('resume-card');
  if (!card || !draft) return;
  if (!draftMatchesCurrentCampaign(draft)) return;
  lastLoadedDraft = draft;

  clientDraftId = draft.clientDraftId || '';
  clientName = draft.clientName || '';
  clientEmail = draft.clientEmail || '';
  privacyConsent = !!draft.privacyConsent;
  privacyConsentAt = draft.privacyConsentAt || '';
  btaiFollowupInterest = draft.btaiFollowupInterest || 'maybe';
  btaiFollowupInterestAt = draft.btaiFollowupInterestAt || '';
  campaignPartner = draft.campaignPartner || campaignPartner || CONFIG.DEFAULT_PARTNER;
  campaignId = draft.campaignId || campaignId || CONFIG.DEFAULT_CAMPAIGN;
  partnerDisplayName = draft.partnerDisplayName || partnerDisplayName || '';
  intakeVariant = draft.intakeVariant || activeIntakeVariant();
  applyCampaignQuestionSet();
  businessName = draft.businessName || '';
  businessCategory = draft.businessCategory || '';
  businessNiche = draft.businessNiche || '';
  shareComfort = draft.shareComfort || 'Directional only';
  websiteUrl = draft.websiteUrl || '';
  companySize = draft.companySize || '';
  ownerWorkStatus = draft.ownerWorkStatus || '';
  departments = Array.isArray(draft.departments) ? draft.departments : [];
  applyPartnerBranding();
  applyWelcomeFields();
  updateDraftSaveStatus('Your saved answers were restored. You can keep going.', 'ok');

  if (draft.interviewStarted) {
    logHermesEvent('resume_prompt_shown', 'success', { autosaveTarget: 'server_encrypted_supabase', resumeUsed: false });
    const when = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'recently';
    document.getElementById('resume-summary').textContent = `Saved progress for ${draft.businessName || draft.clientName || 'this interview'} from ${when}.`;
    card.style.display = 'block';
  }
  applyCampaignCopy();
}

function applyCampaignCopy() {
  if (!isSnapshotFirstCampaign()) return;
  configureSnapshotFrontDoor();
  setText('header-tag', 'AI Opportunity Snapshot');
  setText('welcome-eyebrow', 'Free AI Opportunity Snapshot');
  setHtml('welcome-headline', 'Get a private <em>Snapshot Scorecard</em> before you buy anything.');
  setText('welcome-body', 'In about 8-12 minutes, this interview looks at one frustrating workflow and turns your answers into a private AI Opportunity Snapshot. You will see five directional signals: workflow drag, AI fit, information readiness, human-review boundaries, and the first useful win. General examples are enough; please do not enter private financials, recipes, customer lists, supplier contracts, payroll details, invoices, or confidential operating data.');
  setText('payoff-title', 'Your free report starts with a Snapshot Scorecard');
  setText('payoff-note', 'Directional signals based on your answers, not fake ROI math.');
  setText('gauge-number', '5');
  setText('gauge-label', 'signals we review');
  setText('gauge-sub', 'One clear starting point for AI');
  setText('outcome-title-1', 'Best first AI win');
  setText('outcome-copy-1', 'A practical use case tied to real friction, not AI hype.');
  setText('outcome-title-2', 'Ready vs. cleanup');
  setText('outcome-copy-2', 'A read on whether your information and workflow are ready enough to try.');
  setText('outcome-title-3', 'Useful first move');
  setText('outcome-copy-3', 'One next step or prompt you can use without buying anything.');
  setText('snapshot-result-title', 'What your free snapshot can reveal');
  setText('result-item-1', 'The workflow most likely to benefit from AI because it repeats, slows down, or depends on manual follow-up.');
  setText('result-item-2', 'The type of AI help that looks safest to try first: drafting, organizing, summarizing, checking, reminding, or reporting.');
  setText('result-item-3', 'Whether existing templates, forms, emails, SOPs, or spreadsheets give AI enough structure to work from.');
  setText('result-item-4', 'What should remain human-reviewed, what needs confirmation, and what extra detail a deeper interview would need before a paid plan makes sense.');
  setText('step-one-text', 'You will answer focused questions about one high-friction workflow: how often it happens, how it is handled today, where it slows down, what information exists, and where AI should or should not help.');
  setText('step-four-text', 'A few answers may trigger up to two short follow-ups when more context is needed. Your progress is saved securely as you go, and the free snapshot remains directional rather than a full implementation plan.');
  setText('free-report-title', 'Your free AI Opportunity Snapshot is prepared');
  setText('next-desc-1', 'Bridge To AI creates a private first-pass AI Opportunity Snapshot from your completed interview and sends it to the email address you provided. This free snapshot does not create a business voice/DNA profile.');
  setText('next-desc-2', 'The snapshot is intentionally shorter and directional. If you want more detail, Bridge To AI can invite you into the deeper diagnostic from the same secure interview platform.');
  setText('paid-reports-title', 'Want the deeper diagnostic?');
}

function configureSnapshotFrontDoor() {
  const splash = document.getElementById('snapshot-splash');
  const detail = document.getElementById('welcome-detail');
  if (!splash || !detail) return;
  if (splash.dataset.visited === '1') return;
  splash.classList.add('active');
  detail.classList.add('is-hidden');
}

function configureAfpaCourseFrontDoor() {
  const front = document.getElementById('afpa-course-front');
  const detail = document.getElementById('welcome-detail');
  const splash = document.getElementById('snapshot-splash');
  if (!front || !detail || !isAfpaDecemberAiCourseCampaign()) return;
  if (front.dataset.visited === '1') return;
  if (splash) splash.classList.remove('active');
  front.classList.add('active');
  detail.classList.add('is-hidden');
}

function openAfpaCourseStart() {
  const front = document.getElementById('afpa-course-front');
  const detail = document.getElementById('welcome-detail');
  if (front) {
    front.dataset.visited = '1';
    front.classList.remove('active');
  }
  if (detail) detail.classList.remove('is-hidden');
  const firstInput = document.getElementById('client-name');
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
  window.scrollTo(0, 0);
}

function showAfpaResumeStatus(message) {
  const status = document.getElementById('afpa-resume-status');
  if (!status) return;
  status.textContent = message;
  status.classList.add('active');
}

async function openAfpaCourseResume() {
  const status = document.getElementById('afpa-resume-status');
  if (status) {
    status.textContent = 'Checking this browser for a saved AFPA session...';
    status.classList.add('active');
  }

  const draft = lastLoadedDraft || await loadDraft();
  if (!draft || !draft.interviewStarted || !draftMatchesCurrentCampaign(draft)) {
    lastLoadedDraft = null;
    showAfpaResumeStatus('No active AFPA December course session is available in this browser. Use Continue to interview to start a new one.');
    return;
  }

  lastLoadedDraft = draft;
  await resumeSavedInterview();
}

function openSnapshotStart() {
  const splash = document.getElementById('snapshot-splash');
  const detail = document.getElementById('welcome-detail');
  if (splash) {
    splash.dataset.visited = '1';
    splash.classList.remove('active');
  }
  if (detail) detail.classList.remove('is-hidden');
  const firstInput = document.getElementById('client-name');
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
  window.scrollTo(0, 0);
}

async function openSnapshotResume() {
  openSnapshotStart();
  const card = document.getElementById('resume-card');
  if (card && card.style.display !== 'none') {
    await resumeSavedInterview();
    return;
  }
  const summary = document.getElementById('resume-summary');
  if (summary) summary.textContent = 'If this browser has a saved session, it will appear here. Otherwise, start a new snapshot below.';
}

async function resumeSavedInterview(options = {}) {
  const requireCampaignMatch = options.requireCampaignMatch !== false;
  draftAutosaveEnabled = true;
  const draft = lastLoadedDraft || await loadDraft();
  if (!draft) return;
  if (requireCampaignMatch && !draftMatchesCurrentCampaign(draft)) return;

  clientDraftId = draft.clientDraftId || '';
  clientName = draft.clientName || '';
  clientEmail = draft.clientEmail || '';
  privacyConsent = !!draft.privacyConsent;
  privacyConsentAt = draft.privacyConsentAt || '';
  btaiFollowupInterest = draft.btaiFollowupInterest || 'maybe';
  btaiFollowupInterestAt = draft.btaiFollowupInterestAt || '';
  campaignPartner = draft.campaignPartner || campaignPartner || CONFIG.DEFAULT_PARTNER;
  campaignId = draft.campaignId || campaignId || CONFIG.DEFAULT_CAMPAIGN;
  partnerDisplayName = draft.partnerDisplayName || partnerDisplayName || '';
  intakeVariant = draft.intakeVariant || activeIntakeVariant();
  applyCampaignQuestionSet();
  businessName = draft.businessName || '';
  businessCategory = draft.businessCategory || '';
  businessNiche = draft.businessNiche || '';
  shareComfort = draft.shareComfort || 'Directional only';
  websiteUrl = draft.websiteUrl || '';
  companySize = draft.companySize || '';
  ownerWorkStatus = draft.ownerWorkStatus || '';
  departments = Array.isArray(draft.departments) ? draft.departments : [];
  answers = Array.isArray(draft.answers) ? draft.answers : new Array(QUESTIONS.length).fill('');
  masteryFollowups = Array.isArray(draft.masteryFollowups) ? draft.masteryFollowups : new Array(QUESTIONS.length).fill('');
  masteryFollowupQ = Array.isArray(draft.masteryFollowupQ) ? draft.masteryFollowupQ : new Array(QUESTIONS.length).fill('');
  domainProbes = draft.domainProbes || {};
  snapshotAnswersArchive = Array.isArray(draft.snapshotAnswersArchive) ? draft.snapshotAnswersArchive : [];
  scenarioText = draft.scenarioText || '';
  scenarioGood = draft.scenarioGood || '';
  scenarioBad = draft.scenarioBad || '';
  scenarioStage = draft.scenarioStage || null;
  scenarioDone = !!draft.scenarioDone;
  businessContext = draft.businessContext || null;
  currentQ = Number.isInteger(draft.currentQ) ? draft.currentQ : 0;
  subStep = draft.subStep || 'main';
  activeProbe = draft.activeProbe || null;
  interviewStartedAtMs = interviewStartedAtMs || Date.now();

  applyPartnerBranding();
  applyWelcomeFields();
  logHermesEvent('interview_resumed', 'success', { resumeUsed: true, ...interviewKpiSummary() });
  showScreen('screen-interview');
  if (scenarioStage) renderScenario();
  else renderQuestion();
}

function clearSavedInterview(resetFields = false) {
  if (resetFields) draftAutosaveEnabled = true;
  const priorDraftId = clientDraftId;
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DRAFT_ACCESS_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch (e) { /* ignore */ }
  lastLoadedDraft = null;
  if (priorDraftId) {
    fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', clientDraftId: priorDraftId, draftAccessToken }),
      keepalive: true
    }).catch(() => {});
  }
  const card = document.getElementById('resume-card');
  if (card) card.style.display = 'none';
  if (resetFields) {
    clientName = '';
    clientEmail = '';
    privacyConsent = false;
    privacyConsentAt = '';
    btaiFollowupInterest = 'maybe';
    btaiFollowupInterestAt = '';
    campaignPartner = CONFIG.DEFAULT_PARTNER;
    campaignId = CONFIG.DEFAULT_CAMPAIGN;
    initCampaignContext();
    businessName = '';
    businessCategory = '';
    businessNiche = '';
    shareComfort = 'Directional only';
    websiteUrl = '';
    companySize = '';
    ownerWorkStatus = '';
    departments = [];
    applyWelcomeFields();
  }
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-complete') updateCompletionCampaignOptions();
  window.scrollTo(0, 0);
}

function updateCompletionCampaignOptions() {
  const deepenBox = document.getElementById('deepen-interview-box');
  const completionLayout = document.querySelector('#screen-complete .completion-layout');
  const completionEmailInput = document.getElementById('completion-email-input');
  const snapshotMode = isSnapshotFirstCampaign();
  if (deepenBox) deepenBox.classList.toggle('active', snapshotMode);
  if (completionLayout) completionLayout.classList.toggle('snapshot-simple', snapshotMode);
  if (completionEmailInput) completionEmailInput.value = clientEmail || '';

  if (snapshotMode) {
    setText('complete-message', `Thank you, ${clientName}. Your snapshot interview is complete and securely saved.`);
    setText('free-report-title', 'Your free snapshot is sent by email');
    setText('next-title-2', 'Your email includes deeper options');
    setText('next-title-3', 'Your raw answers stay secure');
    setText('next-desc-1', 'Bridge To AI prepares your private first-pass AI Opportunity Snapshot and sends it to the email address confirmed here.');
    setText('next-desc-2', 'The email includes links if you want the deeper diagnostic, action plan, or implementation/workbench support.');
    setText('next-desc-3', 'Your raw answers are stored securely. Partners receive only anonymized aggregate insights where applicable, not your individual answers.');
  } else {
    setText('free-report-title', 'Your free report is sent by email');
    setText('next-title-2', 'Your email includes next options');
    setText('next-title-3', activePartnerProfile() ? 'AFPA receives aggregate themes only' : 'Your raw answers stay secure');
    setText('next-desc-1', 'Bridge To AI prepares your private AI Opportunity Snapshot and sends it to the email address confirmed here.');
    setText('next-desc-2', 'The email includes links if you want the Detailed AI Opportunity Report, Preliminary AI Action Plan, or implementation/workbench support.');
    setText('next-desc-3', activePartnerProfile()
      ? 'Your individual answers and raw interview record are not shared with AFPA. AFPA may receive anonymized themes to help shape member AI education.'
      : 'Your raw answers are stored securely and used only for your Bridge To AI engagement.');
  }
}

function continueIntoDeepDiagnostic() {
  if (!isSnapshotFirstCampaign()) return;
  if (isRecording) stopRecording();
  captureVisibleTranscript();
  mapCurrentAnswersToFullQuestionSet();
  intakeVariant = 'full_diagnostic_continued';
  campaignId = 'snapshot_to_full';
  applyCampaignQuestionSet();
  currentQ = firstUnansweredFullQuestionIndex(answers);
  subStep = 'main';
  activeProbe = null;
  scenarioStage = null;
  scenarioDone = true;
  draftAutosaveEnabled = true;
  ensureClientDraftId();
  saveDraft(false, true);
  logHermesEvent('snapshot_user_continued_deep_diagnostic', 'success', {
    startingQuestionIndex: currentQ,
    preservedAnswerCount: answers.filter(Boolean).length,
    questionCount: QUESTIONS.length,
    priorVariant: 'snapshot_first',
    nextVariant: intakeVariant
  });
  showScreen('screen-interview');
  renderQuestion();
}

// -- Welcome -> Interview ----------------------------------------------------
async function startInterview(evt) {
  initCampaignContext();
  clientName = document.getElementById('client-name').value.trim();
  clientEmail = normalizeEmail(document.getElementById('client-email').value);
  privacyConsent = document.getElementById('privacy-consent').checked;
  businessName = document.getElementById('business-name').value.trim();
  businessNiche = document.getElementById('business-niche').value.trim();
  businessCategory = businessNiche;
  shareComfort = document.getElementById('share-comfort').value.trim() || 'Directional only';
  websiteUrl = document.getElementById('website-url').value.trim();
  companySize = document.getElementById('company-size').value.trim();
  ownerWorkStatus = document.getElementById('owner-work-status').value.trim();
  departments = Array.from(document.querySelectorAll('.dept-pill input:checked')).map(cb => cb.value);
  const err = document.getElementById('welcome-error');

  const validEmail = updateEmailFieldStatus(true);
  if (!clientName || !clientEmail || !validEmail || !businessName || !businessNiche || !privacyConsent) {
    logHermesEvent('interview_start_blocked', 'failed', {
      missingName: !clientName,
      missingValidEmail: !clientEmail || !validEmail,
      missingBusinessName: !businessName,
      missingBusinessDescription: !businessNiche,
      missingPrivacyConsent: !privacyConsent
    });
    err.style.display = 'block';
    return;
  }
  privacyConsentAt = privacyConsentAt || new Date().toISOString();
  interviewStartedAtMs = interviewStartedAtMs || Date.now();
  err.style.display = 'none';
  answers = new Array(QUESTIONS.length).fill('');
  masteryFollowups = new Array(QUESTIONS.length).fill('');
  masteryFollowupQ = new Array(QUESTIONS.length).fill('');
  domainProbes = {};
  snapshotAnswersArchive = [];
  scenarioText = '';
  scenarioGood = '';
  scenarioBad = '';
  scenarioStage = null;
  scenarioDone = false;
  businessContext = null;
  currentQ = 0;
  subStep = 'main';

  draftAutosaveEnabled = true;
  clearSavedInterview(false);
  clientDraftId = '';
  draftAccessToken = '';
  ensureClientDraftId();
  saveDraft(false, true);
  logHermesEvent('interview_started', 'success', {
    industryPack: industryPackSummary(),
    privacyConsentAt,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    questionCount: QUESTIONS.length,
    businessNiche,
    shareComfort
  });

  // Generate the tailored scenario only for deeper diagnostic interviews.
  const startBtn = evt && evt.target ? evt.target : null;
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Setting up your session...'; }
  await researchBusinessContext();
  if (activeScenarioStepCount() > 0) await generateScenario();
  if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Begin my discovery session ->'; }
  saveDraft(false, true);

  showScreen('screen-interview');
  if (activeScenarioStepCount() === 0) {
    scenarioDone = true;
    scenarioStage = null;
    logHermesEvent('snapshot_voice_scenario_skipped', 'success', {
      reason: 'Voice and standards questions are reserved for deeper diagnostic interviews.'
    });
    renderQuestion();
  } else {
    scenarioStage = 'good';
    renderScenario();
  }
}

// -- Quiet background context research -------------------------------------
async function researchBusinessContext() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const resp = await fetch('/api/interview-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'research-business', businessName, businessCategory, businessNiche, shareComfort, websiteUrl, companySize, ownerWorkStatus, departments, identity: interviewIdentity() }),
      signal: controller.signal
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.context) businessContext = data.context;
    }
  } catch (e) {
    businessContext = null;
  } finally {
    clearTimeout(timeout);
  }
}
// -- Generate a business-tailored scenario -----------------------------------
async function generateScenario() {
  try {
    const resp = await fetch('/api/interview-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'scenario', businessCategory, businessNiche, shareComfort, businessContext, identity: interviewIdentity() })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.scenario && data.scenario.trim()) scenarioText = data.scenario.trim();
    }
  } catch (e) { /* fall back below */ }

  if (!scenarioText) {
    scenarioText = 'A customer reaches out, clearly frustrated that something they were expecting from you is late, and they want to know what is going on.';
  }
}

// -- Render the scenario beats (good reply, then bad reply) -------------------
function renderScenario() {
  if (isRecording) stopRecording();
  document.getElementById('answer-error').style.display = 'none';
  logHermesSectionStarted('scenario', 'Voice & Standards', { questionCount: 2 });
  document.getElementById('btn-back').style.visibility = (scenarioStage === 'good') ? 'hidden' : 'visible';
  document.getElementById('btn-next').textContent = 'Continue ->';

  const totalSteps = (Array.isArray(QUESTIONS) ? QUESTIONS.length : 0) + 2;
  const scenarioStep = scenarioStage === 'good' ? 1 : 2;
  document.getElementById('progress-fill').style.width = Math.round((scenarioStep / totalSteps) * 100) + '%';

  let label, text, hint, saved;
  if (scenarioStage === 'good') {
    label = 'Your Voice & Standards';
    text = 'Read the situation below, then write the reply you\'d be proud of - the one that shows your business at its best.';
    hint = 'SCENARIO: ' + scenarioText + '\n\nDon\'t worry about being polished. Write it the way you actually would, in your own words.';
    saved = scenarioGood;
    document.getElementById('progress-count').textContent = `Your voice - ${scenarioStep} of ${totalSteps}`;
  } else {
    label = 'Your Voice & Standards';
    text = 'Now write the kind of reply you\'ve seen go wrong - rushed, dismissive, or off-brand. The kind you\'d never want sent.';
    hint = 'Same situation as before. Showing what "bad" looks like helps us understand your standards just as much as the good version.';
    saved = scenarioBad;
    document.getElementById('progress-count').textContent = `Your voice - ${scenarioStep} of ${totalSteps}`;
  }

  document.getElementById('q-domain').textContent = label;
  document.getElementById('q-text').textContent = text;
  document.getElementById('q-hint').textContent = hint;
  document.getElementById('progress-label').textContent = label;

  const box = document.getElementById('transcript');
  box.textContent = saved || '';
  updateWordCount();
  if (isRecording) stopRecording();
  saveDraft(false);
}

// -- Advance through the scenario beats --------------------------------------
function normalizedCompanySizeNumber() {
  const match = String(companySize || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isSoloOrNoStaff() {
  const size = normalizedCompanySizeNumber();
  const deptList = Array.isArray(departments) ? departments : [];
  const status = `${ownerWorkStatus || ''} ${deptList.join(' ')}`.toLowerCase();
  return size === 0 || size === 1 || status.includes('semi-retired') || status.includes('semi retired') || status.includes('mostly just me') || status.includes('solo') || status.includes('self-employed') || status.includes('self employed') || status.includes('no employees');
}

function normalizeIndustryText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectIndustryPack() {
  if (isAfpaMemberIntake()) return INDUSTRY_PACKS.food_processing_manufacturing_distribution;
  const categoryMapped = LEGACY_CATEGORY_PACK_MAP[businessCategory];
  if (categoryMapped && INDUSTRY_PACKS[categoryMapped]) return INDUSTRY_PACKS[categoryMapped];
  const haystack = normalizeIndustryText([businessCategory, businessNiche, businessName, websiteUrl].filter(Boolean).join(' '));
  if (!haystack) return INDUSTRY_PACKS.general_business;
  const packs = Object.values(INDUSTRY_PACKS).filter(pack => pack.id !== 'general_business');
  let best = { pack: null, score: 0 };
  packs.forEach(pack => {
    const score = (pack.aliases || []).reduce((total, alias) => {
      const needle = normalizeIndustryText(alias);
      return total + (needle && haystack.includes(needle) ? Math.max(1, needle.split(' ').length) : 0);
    }, 0);
    if (score > best.score) best = { pack, score };
  });
  return best.pack || INDUSTRY_PACKS.general_business;
}

function inferIndustrySubtype(pack, source = '') {
  const text = normalizeIndustryText(source);
  const subtypes = pack?.subtypes || [];
  if (!text || !subtypes.length) return '';
  const match = subtypes.find(subtype => normalizeIndustryText(subtype).split(' ').some(word => word.length > 4 && text.includes(word)));
  return match || '';
}

function currentIndustryGuidance() {
  const base = detectIndustryPack();
  const niche = String(businessNiche || '').trim();
  const subtype = inferIndustrySubtype(base, niche || businessCategory);
  const label = subtype && !/other/i.test(subtype) ? `${subtype} (${base.label})` : base.label;
  return { ...base, label, subtype };
}

function industryList(items) {
  return (items || []).slice(0, 8).join(', ');
}

function industryPackSummary() {
  const guidance = currentIndustryGuidance();
  return {
    id: guidance.id,
    label: guidance.label,
    subtype: guidance.subtype || '',
    opportunities: guidance.opportunities || [],
    customerTypes: guidance.customerTypes || [],
    workflowExamples: guidance.workflowExamples || [],
    riskBoundaries: guidance.riskBoundaries || [],
    reportFraming: guidance.reportFraming || ''
  };
}

function adaptQuestionForContext(q) {
  const guidance = currentIndustryGuidance();
  const industryOverrides = {
    'Business Model & Direction|AI Fit': {
      text: 'Which parts of your business run on manual knowledge work that eats your time?',
      hint: `For a ${guidance.label}, this may include ${industryList(guidance.opportunities)}. Keep examples directional; no confidential details are needed.`
    },
    'Customer Reality|Current Reality': {
      text: 'Describe your best customers or accounts - who are they and why do they choose you?',
      hint: `Use customer types, not names. Examples may include ${industryList(guidance.customerTypes)}.`
    },
    'Customer Reality|AI Fit': {
      text: 'Which customer touchpoints are slow, repetitive, or inconsistent?',
      hint: `Think about follow-up, updates, order questions, buyer readiness, repeat-purchase prompts, onboarding, reviews, or service replies.`
    },
    'Revenue Engine|Revenue Opportunity': {
      text: 'When you think about new revenue, which type of opportunity would matter most right now, and how would you describe its value without sharing exact numbers?',
      hint: `For a ${guidance.label}, this could mean ${industryList(guidance.customerTypes)}. Describe the scale as small but steady, meaningful weekly revenue, meaningful monthly revenue, capacity-changing, hiring/system-justifying, not sure, or better discussed privately later.`
    },
    'Operations & Delivery|AI Fit': {
      text: 'Which delivery or production tasks involve gathering information, writing, checking, planning, or repeating the same decision?',
      hint: `For a ${guidance.label}, possible areas include ${industryList(guidance.opportunities)}. Do not include recipes, exact costs, customer names, or supplier contracts.`
    },
    'Information & Systems|Current Reality': {
      text: 'Where does the important information in your business actually live?',
      hint: 'Think about tools and places, not private records: accounting software, POS, spreadsheets, email, shared drives, notebooks, scheduling tools, production records, CRM, or people\'s heads.'
    },
    'Operations & Delivery|Current Workaround': {
      text: 'How do you handle that work today?',
      hint: `For a ${guidance.shortLabel || guidance.label}, think about ${industryList(guidance.workflowExamples)}. Who starts it, what tools or notes they use, and what workaround keeps it moving?`
    },
    'Information & Systems|Information Location': {
      text: 'Where does the information needed for this work usually live?',
      hint: `Examples: ${industryList(guidance.workflowExamples)}, plus email, spreadsheets, software, shared folders, paper forms, photos, notes, or memory.`
    },
    'Risk & Adoption|Current Reality': {
      text: 'What privacy, compliance, or confidentiality constraints apply to your business?',
      hint: `Relevant boundaries for a ${guidance.shortLabel || guidance.label}: ${industryList(guidance.riskBoundaries)}. Keep this directional; do not paste private records.`
    },
    'Risk & Adoption|Human Review Boundary': {
      text: 'What should AI absolutely not touch or decide without a person reviewing it?',
      hint: `Think about human-review boundaries such as ${industryList(guidance.riskBoundaries)}.`
    },
    'Risk & Adoption|AI Fit': {
      text: 'Which low-risk, reversible AI uses could you try first to build confidence?',
      hint: `Good first tests avoid sensitive data. For a ${guidance.label}, examples might include drafts, checklists, summaries, training notes, follow-up reminders, product or service descriptions, and planning templates.`
    }
  };

  let adapted = industryOverrides[`${q.domain}|${q.type}`] || { text: q.text, hint: q.hint };

  if (!isSoloOrNoStaff()) return adapted;

  const overrides = {
    'People & Decision-Making|Current Reality': {
      text: 'What parts of the business depend entirely on you, and what would pause if you were unavailable?',
      hint: 'Think about sales, delivery, admin, customer replies, decisions, and any informal helpers or future hires.'
    },
    'People & Decision-Making|Pain & Cost': {
      text: 'Where do decisions or tasks bottleneck because they need your personal attention?',
      hint: 'What cannot move forward until you approve it, remember it, explain it, or do it yourself?'
    },
    'People & Decision-Making|Desired Future': {
      text: 'What would it look like if the business could keep moving without you personally touching every step?',
      hint: 'Focus on backup systems, clearer instructions, simple automations, or support a future helper could follow.'
    },
    'People & Decision-Making|AI Fit': {
      text: 'Which decisions or communications depend on your knowledge that AI could help organize, draft, or explain?',
      hint: 'The repeat answers, judgment calls, and customer replies that currently live mostly in your head.'
    },
    'Risk & Adoption|Current Reality': {
      text: 'What privacy, compliance, or confidentiality constraints apply to your business?',
      hint: 'Client data, regulated information, industry rules, and your own comfort level with new tech.'
    },
    'Risk & Adoption|Desired Future': {
      text: 'What would a successful AI rollout look and feel like for you?',
      hint: 'What would change in your day-to-day work, and what would make the system feel trustworthy rather than intrusive?'
    }
  };

  return overrides[`${q.domain}|${q.type}`] || adapted;
}
function nextScenario() {
  const val = document.getElementById('transcript').innerText.trim();
  if (!val || val.length < 5) {
    document.getElementById('answer-error').style.display = 'block';
    return;
  }
  if (isRecording) stopRecording();
  document.getElementById('answer-error').style.display = 'none';

  if (scenarioStage === 'good') {
    scenarioGood = val;
    scenarioStage = 'bad';
    saveDraft(false);
    renderScenario();
  } else {
    scenarioBad = val;
    logHermesSectionCompleted('scenario', 'Voice & Standards', { questionCount: 2, totalWordCount: countWords(scenarioGood) + countWords(scenarioBad) });
    scenarioDone = true;
    saveDraft(false);
    scenarioStage = null;
    // move into the main questionnaire
    currentQ = 0;
    subStep = 'main';
    renderQuestion();
  }
}

function prevScenario() {
  const val = document.getElementById('transcript').innerText.trim();
  if (isRecording) stopRecording();
  if (scenarioStage === 'bad') {
    scenarioBad = val;
    scenarioStage = 'good';
    saveDraft(false);
    renderScenario();
  }
}

// -- Render current question ------------------------------------------------
function clampQuestionIndex(index) {
  const total = Array.isArray(QUESTIONS) ? QUESTIONS.length : 0;
  if (!total) return 0;
  const n = Number.isInteger(index) ? index : 0;
  return Math.max(0, Math.min(n, total - 1));
}

function setTranscriptValue(value = '') {
  const box = document.getElementById('transcript');
  if (!box) return;
  const nextValue = value || '';
  recognitionSessionId += 1;
  box.replaceChildren(document.createTextNode(nextValue));
  updateWordCount();
}

function transitionToQuestion(index, nextSubStep = 'main', nextProbe = null) {
  currentQ = clampQuestionIndex(index);
  subStep = nextSubStep;
  activeProbe = nextProbe;
  renderQuestion();
}

function renderQuestion() {
  try {
    if (isRecording) stopRecording();
    const total = Array.isArray(QUESTIONS) ? QUESTIONS.length : 0;
    if (!total) throw new Error('No interview questions are available.');
    currentQ = clampQuestionIndex(currentQ);
    const q = QUESTIONS[currentQ];
    if (!q) throw new Error(`Missing question at index ${currentQ}`);

    if (subStep === 'main') {
      if (q.section === 'business') logHermesSectionStarted('business_domain', q.domain);
      if (q.section === 'mastery') logHermesSectionStarted('owner_self_assessment', q.domain, { questionCount: 2 });
    }
    if (subStep === 'probe' && activeProbe) logHermesSectionStarted('adaptive_probe', activeProbe.domain, { questionCount: 1 });

    const scenarioSteps = activeScenarioStepCount();
    const totalSteps = total + scenarioSteps;
    const displayStep = currentQ + 1 + scenarioSteps;
    const pct = Math.round((displayStep / totalSteps) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('btn-back').style.visibility = (currentQ === 0 && subStep === 'main' && activeScenarioStepCount() === 0) ? 'hidden' : 'visible';
    document.getElementById('answer-error').style.display = 'none';

    let domainLabel = q.domain || 'Discovery Question';
    const adapted = adaptQuestionForContext(q) || {};
    let qText = adapted.text || q.text || 'Tell us what matters most about this part of your business.';
    let qHint = adapted.hint || q.hint || 'Answer in your own words. A rough answer is better than a polished one.';
    let countText = '';
    let savedValue = answers[currentQ] || '';

    if (subStep === 'followup') {
      domainLabel = (q.domain || 'Discovery Question') + ' - looking ahead';
      qText = masteryFollowupQ[currentQ] || MASTERY_FOLLOWUP;
      qHint = 'There\'s no wrong answer. Picture it actually handled, and tell us what changes.';
      savedValue = masteryFollowups[currentQ] || '';
      countText = 'Follow-up';
    } else if (subStep === 'probe' && activeProbe) {
      domainLabel = (activeProbe.domain || 'Discovery Question') + ' - one more thing';
      qText = activeProbe.question || 'What else should we understand about this before moving on?';
      qHint = 'A quick follow-up to make sure we capture this accurately.';
      savedValue = (domainProbes[activeProbe.key || activeProbe.domain] && domainProbes[activeProbe.key || activeProbe.domain].answer) || '';
      countText = 'Follow-up';
    } else if (q.section === 'mastery') {
      countText = 'About you';
    } else {
      countText = q.type || 'Question';
    }

    if (q.section === 'business' && subStep !== 'followup') {
      qHint = `${qHint}\n\n${SENSITIVE_DETAIL_WARNING}`;
    }

    document.getElementById('q-domain').textContent = domainLabel;
    document.getElementById('q-text').textContent = qText;
    document.getElementById('q-hint').textContent = qHint;
    document.getElementById('progress-label').textContent = domainLabel;
    let progressText = '';
    if (subStep === 'followup' || (subStep === 'probe' && activeProbe)) {
      progressText = `Follow-up after core step ${displayStep} of ${totalSteps}`;
    } else if (countText) {
      progressText = `${countText} - core step ${displayStep} of ${totalSteps}`;
    } else {
      progressText = `Core step ${displayStep} of ${totalSteps}`;
    }
    document.getElementById('progress-count').textContent = progressText;

    const isLastItem = (currentQ === total - 1);
    const lastQ = QUESTIONS[total - 1] || {};
    const isFinalSubStep = isLastItem && (lastQ.section === 'mastery' ? subStep === 'followup' : (subStep === 'probe' || subStep === 'main'));
    document.getElementById('btn-next').textContent = isFinalSubStep ? 'Submit answers ->' : 'Continue ->';

    setTranscriptValue(savedValue);
    if (isRecording) stopRecording();
    saveDraft(false);
  } catch (err) {
    console.error('Question render error:', err);
    logHermesEvent('question_render_failed', 'failed', { error: err.message || 'Question render failed', currentQ, subStep });
    document.getElementById('q-domain').textContent = 'Discovery Question';
    document.getElementById('q-text').textContent = 'Tell us what matters most about your business right now.';
    document.getElementById('q-hint').textContent = 'The interview had trouble loading this question. Please refresh and resume if this repeats.';
    document.getElementById('progress-label').textContent = 'Discovery Question';
    document.getElementById('progress-count').textContent = `Question ${clampQuestionIndex(currentQ) + 1}`;
    document.getElementById('btn-next').textContent = 'Continue ->';
    setTranscriptValue('');
  }
}
function getTranscriptValue() {
  const box = document.getElementById('transcript');
  return box ? (box.innerText || box.textContent || '').trim() : '';
}

function showAnswerError(message) {
  const err = document.getElementById('answer-error');
  if (!err) return;
  if (message) err.textContent = message;
  err.style.display = 'block';
}
// -- Navigation -------------------------------------------------------------
function saveCurrentAnswer(value = null) {
  const val = value === null ? getTranscriptValue() : String(value || '').trim();
  if (subStep === 'followup') {
    masteryFollowups[currentQ] = val;
  } else if (subStep === 'probe' && activeProbe) {
    const probeKey = activeProbe.key || activeProbe.domain || questionProbeKey(currentQ);
    if (!domainProbes[probeKey]) domainProbes[probeKey] = { ...activeProbe, answer: '', asked: true };
    domainProbes[probeKey].answer = val;
    domainProbes[probeKey].asked = true;
  } else {
    answers[currentQ] = val;
  }
}

async function nextQuestion() {
  const btn = document.getElementById('btn-next');
  try {
    if (scenarioStage) { nextScenario(); return; }

    const val = getTranscriptValue();
    if (!val || val.length < 3) {
      showAnswerError('Please type or speak at least a few words before continuing.');
      return;
    }

    if (isRecording) stopRecording();
    saveCurrentAnswer(val);
    logHermesEvent('answer_saved', 'success', { answerTextForMetrics: val });
    document.getElementById('answer-error').style.display = 'none';

    const total = Array.isArray(QUESTIONS) ? QUESTIONS.length : 0;
    currentQ = clampQuestionIndex(currentQ);
    const q = QUESTIONS[currentQ];
    if (!q) throw new Error(`Missing question at index ${currentQ}`);

    if (btn) { btn.disabled = true; btn.textContent = 'Loading next question...'; }

    if (subStep === 'followup') {
      if (currentQ < total - 1) transitionToQuestion(currentQ + 1, 'main', null);
      else submitInterview();
      return;
    }

    if (subStep === 'probe') {
      if (currentQ < total - 1) transitionToQuestion(currentQ + 1, 'main', null);
      else submitInterview();
      return;
    }

    const redirected = await maybeRunAdaptiveRedirect(currentQ, val);
    if (redirected) return;

    if (q.section === 'mastery') {
      await runMasteryFollowup(currentQ);
      return;
    }

    const nextQ = QUESTIONS[currentQ + 1];
    const isDomainEnd = (currentQ === total - 1) || !nextQ || (nextQ.domain !== q.domain) || (nextQ.section !== 'business');
    if (isDomainEnd) {
      logHermesSectionCompleted('business_domain', q.domain, domainAnswerStats(q.domain));
    }

    if (currentQ < total - 1) transitionToQuestion(currentQ + 1, 'main', null);
    else submitInterview();
  } catch (err) {
    console.error('Next question error:', err);
    logHermesEvent('next_question_failed', 'failed', { error: err.message || 'Next question failed', currentQ, subStep });
    showAnswerError('The next question did not load correctly. Please refresh this page, then use Resume.');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btn.textContent === 'Loading next question...') btn.textContent = 'Continue ->';
    }
  }
}
// -- AI probe: ask Claude if this domain's answers need one follow-up --------
function isRepetitiveProbeQuestion(question) {
  const q = String(question || '').toLowerCase();
  const broadProcessPhrases = [
    'current process look like',
    'walk me through',
    'first contact to',
    'fully onboarded',
    'delivering results',
    'is that mostly in your head',
    'documented somewhere',
    'have any of it documented',
    'from first contact',
    'what happens from first contact'
  ];
  return broadProcessPhrases.some(phrase => q.includes(phrase));
}

function generatedProbeCount() {
  return Object.values(domainProbes || {}).filter(probe => probe?.asked && probe?.question).length;
}

function normalizeProbePayload(data) {
  if (!data) return null;
  if (typeof data.followup === 'object' && data.followup) return data.followup;
  const question = String(data.followup || '').trim();
  if (!question || question.toUpperCase() === 'NONE') return null;
  return {
    ask_followup: true,
    question_type: data.question_type || 'clarify',
    question,
    sensitivity_level: data.sensitivity_level || 'low',
    why_needed: data.why_needed || ''
  };
}

function validateProbeCandidate(candidate, domainName) {
  const result = { ok: false, question: '', reason: 'empty' };
  if (!candidate || candidate.ask_followup === false) return { ...result, reason: 'model_skipped' };
  const question = String(candidate.question || '').trim();
  const questionType = String(candidate.question_type || 'clarify').toLowerCase();
  const sensitivity = String(candidate.sensitivity_level || 'low').toLowerCase();

  if (!question) return { ...result, reason: 'empty_question' };
  if (question.length > 260) return { ...result, reason: 'too_long' };
  if (!APPROVED_PROBE_TYPES.includes(questionType)) return { ...result, reason: 'unapproved_question_type' };
  if (!['low', 'medium-low', 'medium_low'].includes(sensitivity)) return { ...result, reason: 'sensitivity_too_high' };
  if (FORBIDDEN_PROBE_PATTERNS.some(pattern => pattern.test(question))) return { ...result, reason: 'forbidden_sensitive_request' };
  if (isRepetitiveProbeQuestion(question)) return { ...result, reason: 'repetitive_probe' };

  const priorText = [
    ...QUESTIONS.map(q => q.text || ''),
    ...Object.values(domainProbes || {}).map(probe => probe?.question || '')
  ].join('\n').toLowerCase();
  const meaningfulWords = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4);
  const overlap = meaningfulWords.filter(w => priorText.includes(w)).length;
  if (meaningfulWords.length >= 8 && overlap / meaningfulWords.length > 0.85) return { ...result, reason: 'too_similar_to_prior_questions' };

  return { ok: true, question, reason: 'accepted', questionType, sensitivity };
}
async function maybeRunAdaptiveRedirect(qIndex, answer) {
  const q = QUESTIONS[qIndex];
  if (!q || !String(answer || '').trim()) return false;
  const probeKey = questionProbeKey(qIndex);
  if (domainProbes[probeKey]?.asked) return false;

  const decision = adaptiveRedirectDecision(q, answer);
  if (!decision.needsRedirect) return false;

  const maxAdaptiveProbes = activeMaxAdaptiveProbes();
  if (generatedProbeCount() >= maxAdaptiveProbes) {
    domainProbes[probeKey] = {
      key: probeKey,
      domain: q.domain || '',
      sourceQuestionIndex: qIndex,
      sourceQuestionType: q.type || '',
      question: null,
      answer: '',
      asked: true,
      rejectedReason: 'limit_reached',
      priorityWeight: decision.priorityWeight
    };
    logHermesEvent('adaptive_probe_rejected_limit_reached', 'success', {
      domain: q.domain || '',
      sourceQuestionIndex: qIndex,
      sourceQuestionType: q.type || '',
      priorityWeight: decision.priorityWeight,
      maxAdaptiveProbes,
      weakAnswerRedirect: true
    });
    return false;
  }

  const btn = document.getElementById('btn-next');
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'One moment...';
    btn.disabled = true;
  }

  logHermesEvent('weak_answer_redirect_needed', 'info', {
    domain: q.domain || '',
    sourceQuestionIndex: qIndex,
    sourceQuestionType: q.type || '',
    priorityWeight: decision.priorityWeight,
    weakAnswerReason: decision.reason,
    answerQualityBucket: decision.quality.bucket,
    weakAnswerRedirect: true,
    ...progressMetrics()
  });
  logHermesSectionStarted('adaptive_probe', q.domain || 'Discovery Question', { questionCount: 1 });

  let probeQuestion = null;
  let probeMeta = null;
  let rejectedReason = '';
  try {
    const resp = await fetch('/api/interview-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'probe', identity: interviewIdentity(),
        domain: q.domain || '',
        qa: `Q (${q.type || 'Question'}): ${q.text || ''}\nA: ${answer || ''}`,
        sourceQuestion: q.text || '',
        sourceQuestionType: q.type || '',
        answerQualityBucket: decision.quality.bucket,
        priorityWeight: decision.priorityWeight,
        weakAnswerReason: decision.reason,
        businessCategory,
        businessNiche,
        shareComfort,
        companySize,
        ownerWorkStatus,
        departments,
        businessContext
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      const candidate = normalizeProbePayload(data);
      if (candidate) {
        const validation = validateProbeCandidate(candidate, q.domain || '');
        if (validation.ok) {
          probeQuestion = validation.question;
          probeMeta = validation;
        } else {
          rejectedReason = validation.reason;
          logHermesEvent('adaptive_probe_rejected_by_guardrail', 'success', {
            domain: q.domain || '',
            sourceQuestionIndex: qIndex,
            sourceQuestionType: q.type || '',
            priorityWeight: decision.priorityWeight,
            rejectedReason,
            proposedQuestionType: candidate.question_type || '',
            sensitivityLevel: candidate.sensitivity_level || ''
          });
        }
      } else {
        rejectedReason = 'model_skipped';
      }
    } else {
      rejectedReason = 'probe_request_failed';
    }
  } catch (e) {
    rejectedReason = 'probe_request_error';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel || 'Continue ->';
    }
  }

  if (!probeQuestion) {
    domainProbes[probeKey] = {
      key: probeKey,
      domain: q.domain || '',
      sourceQuestionIndex: qIndex,
      sourceQuestionType: q.type || '',
      question: null,
      answer: '',
      asked: true,
      rejectedReason,
      priorityWeight: decision.priorityWeight
    };
    logHermesEvent('adaptive_probe_skipped', 'success', {
      domain: q.domain || '',
      sourceQuestionIndex: qIndex,
      sourceQuestionType: q.type || '',
      priorityWeight: decision.priorityWeight,
      rejectedReason
    });
    return false;
  }

  activeProbe = {
    key: probeKey,
    domain: q.domain || '',
    sourceQuestionIndex: qIndex,
    sourceQuestionType: q.type || '',
    question: probeQuestion,
    priorityWeight: decision.priorityWeight
  };
  domainProbes[probeKey] = {
    ...activeProbe,
    answer: '',
    asked: true,
    questionType: probeMeta?.questionType || '',
    sensitivityLevel: probeMeta?.sensitivity || 'low'
  };
  logHermesEvent('adaptive_probe_generated', 'success', {
    domain: q.domain || '',
    sourceQuestionIndex: qIndex,
    sourceQuestionType: q.type || '',
    priorityWeight: decision.priorityWeight,
    questionType: probeMeta?.questionType || '',
    sensitivityLevel: probeMeta?.sensitivity || '',
    generatedProbeCount: generatedProbeCount() + 1,
    weakAnswerRedirect: true
  });
  saveDraft(false);
  transitionToQuestion(qIndex, 'probe', activeProbe);
  return true;
}

// -- Smart mastery follow-up: reflect back what they said, conditionally ------
async function runMasteryFollowup(qIndex) {
  const q = QUESTIONS[qIndex];
  const answer = answers[qIndex] || '';
  const total = QUESTIONS.length;

  // If we already generated a follow-up for this item (e.g. on backtrack), reuse it.
  if (masteryFollowupQ[qIndex]) {
    transitionToQuestion(qIndex, 'followup', null);
    return;
  }

  // Thin answers don't get a smart follow-up - use the generic line directly.
  if (answer.trim().split(/\s+/).filter(Boolean).length < 12) {
    masteryFollowupQ[qIndex] = MASTERY_FOLLOWUP;
    transitionToQuestion(qIndex, 'followup', null);
    return;
  }

  const btn = document.getElementById('btn-next');
  const originalLabel = btn.textContent;
  btn.textContent = 'One moment...';
  btn.disabled = true;
  logHermesEvent('mastery_followup_requested', 'info', { domain: q.domain });

  let followup = null;
  try {
    const resp = await fetch('/api/interview-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'mastery-followup', area: q.domain, answer, businessCategory, businessNiche, shareComfort, companySize, ownerWorkStatus, departments, businessContext, identity: interviewIdentity() })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.followup && data.followup.trim() && data.followup.trim().toUpperCase() !== 'NONE') {
        followup = data.followup.trim();
      }
    }
  } catch (e) {
    followup = null;
  }

  btn.disabled = false;
  btn.textContent = originalLabel;

  // Smart follow-up if we got one; otherwise the generic AI-future line.
  logHermesEvent(followup ? 'mastery_followup_generated' : 'mastery_followup_fallback', 'success', { domain: q.domain });
  masteryFollowupQ[qIndex] = followup || MASTERY_FOLLOWUP;
  transitionToQuestion(qIndex, 'followup', null);
}

function prevQuestion() {
  if (scenarioStage) { prevScenario(); return; }

  saveCurrentAnswer();
  if (isRecording) stopRecording();
  if (subStep === 'followup' || subStep === 'probe') {
    transitionToQuestion(currentQ, 'main', null);
    return;
  }
  if (currentQ === 0 && subStep === 'main' && scenarioDone && activeScenarioStepCount() > 0) {
    scenarioStage = 'bad';
    saveDraft(false);
    renderScenario();
    return;
  }
  if (currentQ > 0) {
    transitionToQuestion(currentQ - 1, 'main', null);
  }
}
// -- Word count -------------------------------------------------------------
document.getElementById('transcript').addEventListener('input', () => { updateWordCount(); saveDraft(); });

document.querySelectorAll('#screen-welcome input, #screen-welcome select').forEach(input => {
  input.addEventListener('input', () => {
    if (input.id === 'client-email') updateEmailFieldStatus(false);
    saveDraft(false);
  });
  input.addEventListener('change', () => {
    if (input.id === 'client-email') updateEmailFieldStatus(false);
    saveDraft(false);
  });
});
document.getElementById('client-email')?.addEventListener('blur', () => updateEmailFieldStatus(true));
document.getElementById('completion-email-input')?.addEventListener('input', () => updateCompletionEmailFieldStatus(false));
document.getElementById('completion-email-input')?.addEventListener('blur', () => updateCompletionEmailFieldStatus(true));
document.querySelectorAll('.dept-pill input').forEach(input => input.addEventListener('change', () => saveDraft(false)));
document.getElementById('privacy-consent').addEventListener('change', event => {
  privacyConsent = event.target.checked;
  if (privacyConsent && !privacyConsentAt) privacyConsentAt = new Date().toISOString();
  logHermesEvent(privacyConsent ? 'privacy_consent_checked' : 'privacy_consent_unchecked', privacyConsent ? 'success' : 'info', {
    privacyProofType: 'consent',
    privacyConsentAt: privacyConsent ? privacyConsentAt : '',
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    rawInterviewIncluded: false,
    partnerRawAccess: false,
    partnerAggregateOnly: true,
    proofStatus: privacyConsent ? 'accepted' : 'not_accepted'
  });
  saveDraft(false);
});
document.querySelectorAll('a[href="/privacy.html"]').forEach(link => {
  link.addEventListener('click', () => logHermesEvent('privacy_policy_link_clicked', 'success', {
    privacyPolicyVersion: PRIVACY_POLICY_VERSION
  }));
});
document.querySelectorAll('input[name="btai-followup"]').forEach(input => {
  input.addEventListener('change', event => {
    btaiFollowupInterest = event.target.value || 'maybe';
    btaiFollowupInterestAt = new Date().toISOString();
    const status = document.getElementById('followup-save-status');
    if (status && !freeReportDeliveryStarted) status.textContent = 'This preference will be included with your free report.';
    logHermesEvent('btai_followup_interest_selected', 'success', {
      btaiFollowupInterest,
      btaiFollowupInterestAt
    });
    saveDraft(false);
  });
});

function saveFollowupPreference(silent = false) {
  const selected = document.querySelector('input[name="btai-followup"]:checked');
  btaiFollowupInterest = selected ? selected.value : 'maybe';
  btaiFollowupInterestAt = new Date().toISOString();
  logHermesEvent('btai_followup_interest_saved', 'success', {
    btaiFollowupInterest,
    btaiFollowupInterestAt
  });
  const status = document.getElementById('followup-save-status');
  if (status && !silent) status.textContent = 'Preference saved with your report request.';
}

function handleReportDeliveryButton() {
  saveFollowupPreference(true);
  if (!updateCompletionEmailFieldStatus(false)) {
    const status = document.getElementById('followup-save-status');
    if (status) status.textContent = 'Please correct the email address before sending the free report.';
    return;
  }
  if (completionTestMode) {
    const status = document.getElementById('followup-save-status');
    if (status) status.textContent = 'Test mode: no report email sent.';
    return;
  }
  triggerFreeReportDelivery({ manual: true });
}

function friendlyReportDeliveryError(message = '') {
  const text = String(message || '').trim();
  if (/No client email found/i.test(text)) {
    return 'The secure record is missing the client email, so the report was not sent. Contact team@bridgetoai.ca with the Record ID.';
  }
  if (/Client email does not match/i.test(text)) {
    return 'The email on this page does not match the secure intake record, so the report was not sent.';
  }
  if (/Supabase is not configured|Supabase request failed/i.test(text)) {
    return 'Secure storage could not be reached, so the report was not sent. Please try again shortly.';
  }
  if (/Missing RESEND_API_KEY|Email service is not configured|Free report email failed|Email delivery failed|RESEND/i.test(text)) {
    return 'The email service did not confirm delivery. Please try again shortly.';
  }
  if (/Automated report delivery is not enabled for this pilot/i.test(text)) {
    return 'Free-report email is not available in this private test yet. Your answers are securely saved.';
  }
  if (/quality gate failed/i.test(text)) {
    return 'The report did not pass the quality check, so it was not sent automatically.';
  }
  if (/fetch|network|Failed to fetch/i.test(text)) {
    return 'The browser could not reach the report server. Please check the connection and try again.';
  }
  return text ? `Report delivery did not confirm: ${text}` : 'We could not confirm report delivery. Please try again or contact team@bridgetoai.ca.';
}
function logAbandonmentProgress(reason = 'pagehide') {
  try {
    captureVisibleTranscript();
    if (!draftAutosaveEnabled || interviewSubmitted || !clientDraftId) return;
    const progress = progressMetrics({ abandonmentReason: reason, abandoned: true });
    if (progress.completedPromptCount <= 0 && !scenarioStage) return;
    const now = Date.now();
    if (now - lastAbandonmentLogAt < 1500) return;
    lastAbandonmentLogAt = now;
    logHermesEvent('interview_abandoned_progress', 'info', progress);
  } catch (e) { /* monitoring must never block navigation */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && draftAutosaveEnabled && clientDraftId) {
    logAbandonmentProgress('visibility_hidden');
    logHermesEvent('page_hidden_with_active_or_draft_session', 'info', interviewKpiSummary());
  }
});
window.addEventListener('pagehide', () => {
  logAbandonmentProgress('pagehide');
});
window.addEventListener('beforeunload', () => {
  logAbandonmentProgress('beforeunload');
  saveDraft();
  flushDraftSave(true);
});
showResumeCardIfNeeded();

function updateWordCount() {
  const text = document.getElementById('transcript').innerText.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('char-count').textContent = words + (words === 1 ? ' word' : ' words');
}

// -- Voice recording --------------------------------------------------------
function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Please use Chrome or Edge, or type your answer.');
    return;
  }

  recognitionSessionId += 1;
  const sessionId = recognitionSessionId;
  const activeRecognition = new SpeechRecognition();
  recognition = activeRecognition;
  activeRecognition.continuous = true;
  activeRecognition.interimResults = true;
  activeRecognition.lang = 'en-CA';

  const box = document.getElementById('transcript');
  let baseText = box.innerText.trim();
  if (baseText) baseText += ' ';

  activeRecognition.onresult = (e) => {
    if (sessionId !== recognitionSessionId || recognition !== activeRecognition) return;
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        final += e.results[i][0].transcript + ' ';
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    if (final) baseText += final;
    box.textContent = baseText + interim;
    updateWordCount();
  };

  activeRecognition.onerror = (e) => {
    if (sessionId !== recognitionSessionId || recognition !== activeRecognition) return;
    if (e.error !== 'no-speech') stopRecording();
  };

  activeRecognition.onend = () => {
    if (sessionId === recognitionSessionId && isRecording && recognition === activeRecognition) activeRecognition.start();
  };

  activeRecognition.start();
  isRecording = true;

  const btn = document.getElementById('voice-btn');
  btn.classList.add('recording');
  document.getElementById('voice-label').textContent = 'Recording - click to stop';
}

function stopRecording() {
  recognitionSessionId += 1;
  const activeRecognition = recognition;
  recognition = null;
  if (activeRecognition) {
    activeRecognition.onend = null;
    try { activeRecognition.stop(); } catch (e) { /* ignore already-stopped recognition */ }
  }
  isRecording = false;
  const btn = document.getElementById('voice-btn');
  btn.classList.remove('recording');
  document.getElementById('voice-label').textContent = 'Click to speak';
}

// -- Submit & process -------------------------------------------------------
async function submitInterview() {
  interviewSubmitted = true;
  showScreen('screen-processing');
  animateProcessingSteps();

  try {
    saveDraft(true, true);
    await flushDraftSave(false);
    logHermesEvent('interview_completed_answers', 'success', interviewKpiSummary());
    const dnaContent = await generateDNAWithClaude();
    if (!lastSecureStorage || !lastSecureStorage.saved) {
      throw new Error(lastSecureStorage?.reason || 'Secure Supabase storage did not confirm');
    }

    logHermesEvent('drive_save_result', 'success', { driveSaved: false, driveReason: 'Secure Supabase storage is primary; plaintext Drive save skipped.' });
    logHermesEvent('email_delivery_result', 'skipped', { emailDelivered: false, reason: 'Completion notifications are disabled for this private preview.', driveSaved: false });
    logHermesEvent('interview_submission_complete', 'success', interviewKpiSummary());

    draftAutosaveEnabled = false;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch (e) { /* ignore */ }
    const card = document.getElementById('resume-card');
    if (card) card.style.display = 'none';
    if (window.processingTimer) clearInterval(window.processingTimer);
    showScreen('screen-complete');
    document.getElementById('complete-message').textContent =
      isSnapshotFirstCampaign()
        ? `Thank you, ${clientName}. Your free AI Opportunity Snapshot has been encrypted and securely saved. It will be used only to prepare your private first-pass report - never shared, never sold, never made public.`
        : (activePartnerProfile()?.completion || `Thank you, ${clientName}. Your business profile has been encrypted and securely saved. It will be used only to prepare your custom AI plan - never shared, never sold, never made public.`);
    updateCompletionCampaignOptions();
    saveFollowupPreference(true);
    const status = document.getElementById('followup-save-status');
    if (status) status.textContent = 'Confirm the email address, then send your free report.';
  } catch (err) {
    console.error('Submission error:', err);
    logHermesEvent('submission_failed', 'failed', { emailDelivered: false, error: err.message || 'Submission failed', ...interviewKpiSummary() });
    if (window.processingTimer) clearInterval(window.processingTimer);
    showScreen('screen-complete');
    updateCompletionCampaignOptions();
    if (err.privacyReviewRequired) {
      document.getElementById('complete-message').textContent =
        `Thank you, ${clientName}. Your interview was encrypted and saved, but the Bridge To AI Privacy Gate paused automatic report generation because sensitive details may be present. The Bridge Team will review the sanitized record before preparing or sending your report.`;
      const status = document.getElementById('followup-save-status');
      if (status) status.textContent = 'Privacy review required before automatic report delivery.';
      const deliveryButton = document.getElementById('report-delivery-btn');
      if (deliveryButton) {
        deliveryButton.textContent = 'Privacy review required before report delivery';
        deliveryButton.disabled = true;
      }
      return;
    }
    document.getElementById('complete-message').textContent =
      `Thank you, ${clientName}. Your interview is complete and securely saved. Use the button below to send your free report.`;
  }
}

function animateProcessingSteps() {
  const steps = ['pstep-1', 'pstep-2', 'pstep-3', 'pstep-4'];
  const snapshotMode = isSnapshotFirstCampaign();
  const messages = snapshotMode
    ? [
      'Reviewing your answers for the clearest first AI opportunity.',
      'Creating a secure opportunity snapshot from your directional answers.',
      'Preparing the free report and privacy proof trail.',
      'Saving encrypted records and preparing delivery.',
      'Still working. This can take a little longer when the report service is busy, but the snapshot is still being prepared securely.'
    ]
    : [
      'Reviewing the full interview for business patterns and constraints.',
      'Creating the secure business profile. Longer answers can take a little more time.',
      'Preparing the free-report analysis and proof trail.',
      'Saving encrypted records and preparing your next step.',
      'Still working. This is normal for a detailed profile, especially after a full interview.'
    ];
  const startedAt = Date.now();
  let activeStep = 0;

  setText('processing-title', snapshotMode ? 'Creating your private AI Opportunity Snapshot...' : 'Creating your private business profile...');
  setText('processing-body', snapshotMode
    ? 'Your answers are being turned into a secure first-pass opportunity snapshot. The free report is prepared after your encrypted record is saved, and deeper reports are generated only if you request them.'
    : 'Your answers are being turned into a secure business profile. The free report is prepared after your secure record is saved, and deeper reports are generated only when requested.');
  setText('pstep-1-label', snapshotMode ? 'Reviewing your snapshot answers' : 'Reviewing the full interview');
  setText('pstep-2-label', snapshotMode ? 'Creating the secure opportunity snapshot' : 'Creating the secure business profile');
  setText('pstep-3-label', snapshotMode ? 'Preparing the free report' : 'Preparing report-ready insights');
  setText('pstep-4-label', 'Saving encrypted records securely');

  steps.forEach((id, index) => {
    const step = document.getElementById(id);
    step.classList.toggle('active', index === 0);
    step.classList.remove('done');
    step.querySelector('.p-icon').textContent = String(index + 1);
  });

  const timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = String(elapsed % 60).padStart(2, '0');
    const timerEl = document.getElementById('processing-timer');
    const bodyEl = document.getElementById('processing-body');

    if (timerEl) timerEl.textContent = `Working for ${minutes}:${seconds}. Please keep this tab open until you see the confirmation screen.`;
    if (bodyEl) bodyEl.textContent = messages[Math.min(Math.floor(elapsed / 25), messages.length - 1)];

    const nextStep = Math.min(Math.floor(elapsed / 30), steps.length - 1);
    if (nextStep !== activeStep) {
      document.getElementById(steps[activeStep]).classList.remove('active');
      document.getElementById(steps[activeStep]).classList.add('done');
      document.getElementById(steps[activeStep]).querySelector('.p-icon').textContent = '\u2713';
      activeStep = nextStep;
      document.getElementById(steps[activeStep]).classList.add('active');
    }
  }, 1000);

  window.processingTimer = timer;
}

// -- Build prompt for Claude ------------------------------------------------
function buildPrivacyScanText() {
  const boundaryCategoryPattern = /\b(?:private financials?|recipes?|formulas?|customer lists?|customer names?|client lists?|client names?|supplier contracts?|customer contracts?|vendor contracts?|contracts?|payroll|invoices?|confidential operating data|confidential formulas?|regulated data)\b/gi;
  const answerForPrivacyScan = (question, value) => {
    const answer = String(value || '').trim();
    if (!answer) return '';
    const boundaryQuestion = /risk|boundary|human review|do not automate|should ai absolutely not touch/i.test(`${question?.domain || ''} ${question?.type || ''} ${question?.text || ''}`);
    if (boundaryQuestion) {
      return answer.replace(boundaryCategoryPattern, '[BOUNDARY_CATEGORY]');
    }
    return answer;
  };
  const pack = industryPackSummary();
  const lines = [
    'PARTICIPANT-PROVIDED INTAKE DATA',
    `Business Name: ${businessName || ''}`,
    `Business Description: ${businessNiche || businessCategory || ''}`,
    `Detail-Sharing Comfort: ${shareComfort || ''}`,
    `Website URL: ${websiteUrl || ''}`,
    `Company Size: ${companySize || ''}`,
    `Owner Work Status / Capacity: ${ownerWorkStatus || ''}`,
    `Departments / Functions: ${departments.join(', ')}`,
    `Industry Pack: ${pack.label || ''}`,
    `Industry Privacy Boundaries: ${industryList(pack.riskBoundaries) || ''}`
  ];

  QUESTIONS.forEach((q, i) => {
    const answer = answerForPrivacyScan(q, answers[i]);
    if (!answer) return;
    lines.push(`\n[${q.domain} - ${q.type}]`);
    lines.push(answer);
  });

  Object.keys(domainProbes || {}).forEach(domain => {
    const probe = domainProbes[domain];
    if (!probe?.answer) return;
    lines.push(`\n[Adaptive follow-up - ${domain}]`);
    lines.push(String(probe.answer || '').trim());
  });

  snapshotAnswersArchive.forEach(item => {
    if (!item?.answer) return;
    lines.push(`\n[Snapshot archive - ${item.domain || ''} - ${item.type || ''}]`);
    lines.push(String(item.answer || '').trim());
  });

  if (scenarioGood || scenarioBad) {
    lines.push('\n[Voice and standards answers]');
    if (scenarioGood) lines.push(`Best reply: ${scenarioGood}`);
    if (scenarioBad) lines.push(`Off-brand reply: ${scenarioBad}`);
  }

  return lines.join('\n').trim();
}

function buildPrompt() {
  // -- Business answers, grouped by domain, with any AI probe appended --
  let businessBlock = '';
  let lastDomain = null;
  QUESTIONS.forEach((q, i) => {
    if (q.section !== 'business') return;
    if (q.domain !== lastDomain) {
      // close previous domain's probe

      businessBlock += `\n### DOMAIN: ${q.domain}\n`;
      lastDomain = q.domain;
    }
    businessBlock += `[${q.type}] ${q.text}\n-> ${answers[i] || '(no answer provided)'}\n`;
    probeEntriesForQuestion(i).forEach(probe => {
      if (!probe?.answer) return;
      businessBlock += `  FOLLOW-UP (${probe.sourceQuestionType || probe.questionType || 'adaptive'}): ${probe.question}\n  ANSWER: ${probe.answer}\n`;
    });
  });

  const snapshotArchiveBlock = snapshotAnswersArchive.length ? snapshotAnswersArchive.map(item => (
    `\n[${item.domain} - ${item.type}]\nQUESTION: ${item.question}\nANSWER: ${item.answer}`
  )).join('\n') : 'None.';

  // -- Owner-mastery answers, each with its AI-future follow-up --
  let masteryBlock = '';
  QUESTIONS.forEach((q, i) => {
    if (q.section !== 'mastery') return;
    masteryBlock += `\n### ${q.domain}\n`;
    masteryBlock += `Where they are now: ${answers[i] || '(no answer provided)'}\n`;
    masteryBlock += `If AI handled it: ${masteryFollowups[i] || '(no answer provided)'}\n`;
  });
  if (!masteryBlock && isSnapshotFirstCampaign()) {
    masteryBlock = 'Not captured in this shorter free Snapshot First interview. The free interview includes one practical leverage question, but it does not include the full owner mastery self-assessment.';
  }

  // -- Voice & Standards: the good vs. bad reply contrast --
  const hasVoiceProfile = activeScenarioStepCount() > 0;
  const voiceBlock = hasVoiceProfile ? `
SCENARIO PRESENTED: ${scenarioText || '(none)'}

THEIR "BEST / PROUD" REPLY:
${scenarioGood || '(no answer provided)'}

THEIR "BAD / OFF-BRAND" REPLY (what they'd never want sent):
${scenarioBad || '(no answer provided)'}
` : 'Not captured in this shorter free Snapshot First interview. Voice, standards, and Business DNA profile material belongs to the deeper diagnostic interview.';

  const contextBlock = businessContext ? `
PRIVATE BUSINESS CONTEXT PROFILE:
Source: ${businessContext.source || 'business description / provided website'}
Website URL provided: ${websiteUrl || '(not provided)'}
Summary: ${businessContext.summary || '(none)'}
Offers / services: ${businessContext.offers && businessContext.offers.length ? businessContext.offers.join('; ') : '(none)'}
Likely customers: ${businessContext.likelyCustomers && businessContext.likelyCustomers.length ? businessContext.likelyCustomers.join('; ') : '(none)'}
Positioning: ${businessContext.positioning || '(none)'}
Tone notes: ${businessContext.tone || '(none)'}
Likely workflows: ${businessContext.likelyWorkflows && businessContext.likelyWorkflows.length ? businessContext.likelyWorkflows.join('; ') : '(none)'}
Likely AI opportunities: ${businessContext.likelyAiOpportunities && businessContext.likelyAiOpportunities.length ? businessContext.likelyAiOpportunities.join('; ') : '(none)'}
Question guidance used during interview: ${businessContext.questionGuidance && businessContext.questionGuidance.length ? businessContext.questionGuidance.join('; ') : '(none)'}

Use this as background signal only. Do not claim that website observations are facts unless the client's own answers confirm them. Where useful, compare what the business appears to offer with what the client says they actually do.
` : 'PRIVATE BUSINESS CONTEXT PROFILE: Not available.';

  const interviewModeDescription = isSnapshotFirstCampaign()
    ? 'a shorter Snapshot First interview: a focused first-pass diagnostic designed to produce a useful free AI Opportunity Snapshot and identify whether a deeper diagnostic is warranted. It does not include the Voice & Standards scenario and must not be treated as a complete Business DNA interview'
    : 'a deep 8-domain business diagnostic plus a 6-part owner self-assessment';
  const interviewDepthInstruction = isSnapshotFirstCampaign()
    ? 'This was the shorter Snapshot First campaign. Treat missing detail as an intentional limitation of the first pass. Give Darren a high-signal opportunity brief, but do not create a business voice/DNA profile. Label deeper workflow sequencing, readiness scoring, ROI, implementation assumptions, and voice/brand conclusions as Needs confirmation or Requires the deeper interview.'
    : 'This was the full diagnostic path. Use the full answer set to produce the richest practical brief possible while still respecting the certainty rules.';
  const artifactName = isSnapshotFirstCampaign() ? 'AI Opportunity Snapshot Brief' : 'Business DNA file';
  const section9Instruction = hasVoiceProfile
    ? 'Synthesize Part C. From the contrast between their "best" and "bad" replies, capture: their brand voice and tone (the words, warmth, and style of the good reply), the specific standards they hold (what made the bad version bad in their eyes), and the dos/don\'ts an AI clone must follow to sound like them. This is the raw material for matching their voice in any AI build. Quote directly where it reveals their voice.'
    : 'State clearly that Voice & Standards were not captured in the free Snapshot First interview. Do not infer brand voice, writing tone, AI clone rules, or Business DNA from the shorter question set. List this as a reason to continue into the deeper interview if voice-matched AI outputs are desired.';
  const opportunitySourceNote = hasVoiceProfile
    ? 'the voice/standards in Part C'
    : 'the stated business answers only; do not use inferred voice/standards because they were not captured';
  const pack = industryPackSummary();

  return `You are a business analyst for Bridge To AI, an AI implementation consulting firm run by Darren Randles (Kandar Consulting, Alberta, Canada).

A new client has just completed their Bridge To AI interview - ${interviewModeDescription}. Your job is to produce a complete, structured ${artifactName} from their answers. This file is CONFIDENTIAL - it goes directly to Darren, not to the client.

CLIENT INFORMATION:
Owner Name: ${clientName}
Owner Email: ${clientEmail || '(not provided)'}
Business Name: ${businessName}
Business Description: ${businessNiche || businessCategory || '(not specified)'}
Detail-Sharing Comfort: ${shareComfort || '(not specified)'}
Website URL: ${websiteUrl || '(not provided)'}
Company Size: ${companySize ? companySize + ' people' : '(not specified)'}
Owner Work Status / Capacity: ${ownerWorkStatus || '(not specified)'}
Departments / Functions: ${departments.length ? departments.join(', ') : '(not specified)'}
Industry Pack: ${pack.label || '(not specified)'}
Industry Pack ID: ${pack.id || '(not specified)'}
Detected Subtype: ${pack.subtype || '(not specified)'}
Industry Workflow Examples: ${industryList(pack.workflowExamples) || '(not specified)'}
Industry AI Opportunity Areas: ${industryList(pack.opportunities) || '(not specified)'}
Industry Privacy / Human Review Boundaries: ${industryList(pack.riskBoundaries) || '(not specified)'}
Industry Report Framing: ${pack.reportFraming || '(not specified)'}
Privacy Consent: ${privacyConsent ? 'Accepted' : 'Not accepted'}
Privacy Policy Version: ${PRIVACY_POLICY_VERSION}
Privacy Consent Timestamp: ${privacyConsentAt || '(not recorded)'}
Partner: ${partnerDisplayName || campaignPartner || '(not specified)'}
Campaign: ${campaignId || '(not specified)'}
Intake Variant: ${intakeVariant}
Question Set: ${isSnapshotFirstCampaign() ? 'Snapshot First short set' : isAfpaMemberIntake() ? 'AFPA member 20-question set' : 'Full diagnostic set'}
Interview Date: ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}

Use the Industry Pack as vocabulary and context guidance. Do not pretend to be a licensed expert in the client's trade or regulated field. For healthcare/care services, keep recommendations non-clinical and explicitly preserve privacy/human-review boundaries. For food businesses, avoid recipes, formulas, customer lists, supplier contracts, private financials, and food-safety decisions without human review. For trades, keep safety, code, insurance, and legal decisions human-reviewed. For professional services, avoid confidential client strategy, legal/financial advice, HR records, and private client data.

Use company size, owner work status, and department structure to calibrate your recommendations: a solo operator, semi-retired owner, or side-business operator needs different AI leverage than a 50-person, multi-department business. If they are solo or semi-retired, do not imply staff exist unless the client clearly said so. Where departments are listed, consider whether AI opportunities should be scoped per-function, per-person, or future-hire readiness.

INTERVIEW DEPTH NOTE:
${interviewDepthInstruction}

${contextBlock}

=======================================
SNAPSHOT FIRST ANSWERS ALREADY PROVIDED
=======================================
${snapshotArchiveBlock}

=======================================
PART A - BUSINESS DIAGNOSTIC (8 domains)
=======================================
${businessBlock}

=======================================
PART B - OWNER SELF-ASSESSMENT (6 areas)
${isSnapshotFirstCampaign() || isAfpaMemberIntake() ? 'The full owner mastery section was not part of this shorter intake. Do not infer a coaching-style owner profile.' : 'Each area: where the owner is today, and what they\'d want AI to free up.'}
=======================================
${masteryBlock}

=======================================
PART C - VOICE & STANDARDS
${hasVoiceProfile ? 'The client reacted to a scenario twice: their best reply, and a deliberately bad one.\nThe CONTRAST reveals their brand voice, tone, and the standards they hold.' : 'This section was not part of the free Snapshot First interview.'}
=======================================
${voiceBlock}

Produce a complete ${artifactName} in markdown format with these sections.

IMPORTANT CERTAINTY RULES:
- This first intake is a trust-first directional diagnostic, not a confidential financial audit.
- Do not invent exact ROI, savings, margin, payroll, customer value, or implementation cost.
- Use these labels whenever making conclusions: "Stated by the business", "Directional signal", "Inferred by BTAI", or "Requires private scoping to validate".
- If a recommendation depends on exact financials, recipes, invoices, supplier contracts, customer lists, or proprietary data, state that it belongs in a private implementation scoping session.
- Treat volunteered sensitive details carefully and generalize them where possible.

# [BUSINESS NAME] - ${isSnapshotFirstCampaign() ? 'AI OPPORTUNITY SNAPSHOT BRIEF' : 'VENTURE DNA'}
## ${isSnapshotFirstCampaign() ? 'Snapshot First Interview' : 'Business DNA Interview'} | ${new Date().toLocaleDateString('en-CA')}

### SECTION 1: CLIENT IDENTITY
Business name, owner, category, date, interview method.

### SECTION 2: WHAT THIS BUSINESS DOES
2-3 sentence summary of their revenue model, core deliverable, and who benefits. Use their actual words where possible.

### SECTION 3: IDEAL CLIENT PROFILE
Who they serve, who they don't, what triggers a buying decision, what success looks like for their clients.

### SECTION 4: REVENUE ENGINE
How leads come in, how sales happen, where deals stall, what the conversion process looks like.

### SECTION 5: OPERATIONS & DELIVERY
How work moves from sale to result. Key steps, handoffs, recurring workflows, where things slow down.

### SECTION 6: INFORMATION & SYSTEMS
Where data lives, what tools are in use, data quality issues, what decisions are made without good information.

### SECTION 7: PEOPLE & DECISION-MAKING
Who owns what, where tribal knowledge is locked, where decisions require the owner, what would break without them.

### SECTION 8: OWNER MASTERY PROFILE
${isSnapshotFirstCampaign() ? 'State clearly that the full owner mastery profile was not captured in the free Snapshot First interview. Use only the practical leverage answer to describe what the owner hopes to do if one frustrating/repetitive task becomes easier. Do not infer a coaching-style owner profile.' : 'Synthesize Part B. For each of the 6 areas (Personal Productivity, Strategy & Decision-Making, Time & Leverage, Sales & Influence, Marketing & Messaging, Operations & Efficiency): where the owner currently stands, and - critically - where THEY said they want AI to help. This is the owner telling you in their own words where AI should go. Treat it as high-signal.'}

### SECTION 9: VOICE & STANDARDS PROFILE
${section9Instruction}

### SECTION 10: AI OPPORTUNITY PORTFOLIO
List 6-10 specific AI opportunities ranked by Impact x Feasibility (both scored 1-5, multiply). Format as a table. Draw from the business diagnostic, the owner's stated AI wishes in Part B, the Revenue Engine opportunity type/scale, the AI Opportunity commercial objective, and ${opportunitySourceNote}. Include a "Certainty" column using the certainty labels above. Use directional ROI language such as time relief, consistency gain, capacity unlocked, confidence improved, risk reduced, or revenue opportunity supported. If exact numbers are missing, state the assumption needed rather than inventing one.

### SECTION 11: READINESS SCORECARD
Score these 5 dimensions 1-5 with one-line finding each:
- Data & Information Quality
- Workflow Documentation
- Tools & Tech Stack
- People & Change Readiness
- Risk & Compliance Posture
Total score out of 25. Assign a readiness tier: Launch-Ready (21-25), Near-Ready (16-20), Foundation First (11-15), Rebuild Required (6-10), Not Ready (1-5).

### SECTION 12: DO NOW / BUILD NEXT / AVOID FOR NOW
Three clear boxes. Each action includes what to do and why.

### SECTION 13: 30-60-90 DAY ROADMAP
Three phases with specific tasks, owners, effort estimates, and outputs. Include 90-day success metrics.

### SECTION 14: KEY QUOTES
Capture 4-6 direct quotes from the client's answers (business, owner, or voice sections) that reveal their mindset, priorities, or hidden constraints.

### SECTION 15: CONSULTANT NOTES FOR DARREN
What stood out. What the client didn't say but implied. What to probe in the next conversation. Any risks or red flags. Note especially any mismatch between where the business needs AI and where the OWNER wants AI - that gap is where engagements succeed or fail. Pay special attention to their execution track record (Section 8, "Execution Reality" questions) and whether freed time will be redirected to revenue work or wasted.

EVIDENCE DISCIPLINE:
For every major finding, recommendation, readiness score, roadmap item, and AI opportunity, include one evidence label in plain text:
- Client-stated: the client directly said it.
- Derived: it follows clearly from multiple client answers.
- Inferred: it is a reasonable hypothesis, but not directly proven.
- Needs confirmation: the interview did not provide enough evidence.

Do not present inferred ideas as facts. If a number, workflow, employee role, customer segment, constraint, or tool was not supplied, label it Inferred or Needs confirmation. If the client appears solo, semi-retired, or no-staff, do not imply employees or departments exist unless the client clearly said so.

Be specific, direct, and honest. Do not soften constraints or inflate readiness scores. Use the client's actual language where it reveals something true about how they think.`;
}

// -- Call Anthropic API -----------------------------------------------------
async function generateDNAWithClaude() {
  const response = await fetch('/api/generate-dna', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: buildPrompt(),
      clientDraftId: ensureClientDraftId(),
      draftAccessToken,
      sourceMeta: {
        partner: campaignPartner,
        campaign: campaignId,
        partnerDisplayName,
        intakeVariant,
        privacyScanText: buildPrivacyScanText(),
        questionSet: activeQuestionSetName(),
        industryPack: industryPackSummary(),
        businessCategory,
        companySize,
        ownerWorkStatus,
        questionCount: QUESTIONS.length,
        soloOrNoStaff: isSoloOrNoStaff(),
        privacyConsent,
        privacyConsentAt,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        partnerAggregateDisclosureShown: !!activePartnerProfile(),
        partnerAggregateDisclosureAccepted: !!privacyConsent,
        crossBorderProcessingNoticePresented: true,
        serviceProviderPolicyAvailable: true,
        privacyContactPresented: true,
        deletionRequestPathAvailable: true
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409 && /Privacy review required/i.test(data.error || data.message || '')) {
      if (data.secureStorage) lastSecureStorage = data.secureStorage;
      const privacyErr = new Error(data.message || 'Privacy review required before report generation can continue');
      privacyErr.privacyReviewRequired = true;
      privacyErr.privacyGate = data.privacyGate || null;
      throw privacyErr;
    }
    throw new Error(data.message || data.error || 'DNA generation failed');
  }
  if (data.hermesPrivacy) {
    logHermesEvent('tokenization_result', data.hermesPrivacy.anonymized ? 'success' : 'failed', {
      privacyProofType: 'browser_confirmation_anonymization',
      privacyAnonymized: !!data.hermesPrivacy.anonymized,
      anonymizationReplacements: data.hermesPrivacy.stats?.replacements || 0,
      identifiersReplaced: (data.hermesPrivacy.stats?.replacements || 0) > 0,
      rawInterviewIncluded: false,
      aiPayloadType: 'anonymized_business_profile',
      piiMappingStoredEncrypted: !!data.hermesPrivacy.mappingSaved,
      driveSaved: !!data.hermesPrivacy.mappingSaved,
      driveReason: data.hermesPrivacy.mappingSaveReason || '',
      proofStatus: data.hermesPrivacy.anonymized ? 'passed' : 'failed'
    });
  }
  if (data.secureStorage) {
    lastSecureStorage = data.secureStorage;
    logHermesEvent('secure_storage_result', data.secureStorage.saved ? 'success' : 'failed', {
      privacyProofType: 'browser_confirmation_secure_storage',
      draftSaved: !!data.secureStorage.saved,
      encryptedAtRest: !!data.secureStorage.saved,
      encryptionAlg: 'AES-256-GCM',
      rawDnaIncluded: false,
      partnerRawAccess: false,
      proofStatus: data.secureStorage.saved ? 'passed' : 'failed',
      error: data.secureStorage.reason || ''
    });
  }
  return data.dnaContent;
}

// -- Send email via serverless function ------------------------------------
async function sendEmailWithDNA() {
  const payload = {
    recordId: ensureClientDraftId(),
    draftAccessToken
  };

  const response = await fetch(CONFIG.EMAIL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errorBody = await response.json();
      detail = errorBody && (errorBody.details || errorBody.message || errorBody.error) ? `: ${JSON.stringify(errorBody.details || errorBody.message || errorBody.error)}` : '';
    } catch (e) { /* ignore parse errors */ }
    throw new Error('Email send failed' + detail);
  }
}

function triggerFreeReportDelivery(options = {}) {
  const button = document.getElementById('report-delivery-btn');
  const status = document.getElementById('followup-save-status');
  if (completionTestMode) {
    if (status) status.textContent = 'Test mode: no report email sent.';
    return;
  }
  if (freeReportDeliverySucceeded) {
    if (status) status.textContent = `Your free report has already been sent to ${clientEmail}.`;
    return;
  }
  if (freeReportDeliveryStarted) {
    if (status) status.textContent = `Your free report is being prepared and sent to ${clientEmail}.`;
    return;
  }

  freeReportDeliveryStarted = true;
  if (button) {
    button.textContent = 'Sending your free report...';
    button.disabled = true;
  }
  if (status) status.textContent = `Preparing and sending your free report to ${clientEmail}.`;

  const payload = {
    action: 'generate-free-email',
    clientDraftId: ensureClientDraftId(),
    draftAccessToken
  };

  fetch(CONFIG.REPORT_PACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || data.message || 'Free report delivery failed');
      freeReportDeliverySucceeded = true;
      if (button) {
        button.textContent = 'Free report email sent';
        button.disabled = true;
      }
      if (status) status.textContent = `Your free report has been sent to ${clientEmail}.`;
      logHermesEvent('free_report_delivery_result', 'success', {
        emailed: !!data.emailed,
        recipientConfirmed: !!data.recipient,
        deliveryMode: options.manual ? 'manual_click' : 'automatic_completion'
      });
    })
    .catch(err => {
      freeReportDeliveryStarted = false;
      if (button) {
        button.textContent = 'Try sending my free report again';
        button.disabled = false;
      }
      if (status) status.textContent = friendlyReportDeliveryError(err.message);
      console.error('Free report delivery failed:', err);
      logHermesEvent('free_report_delivery_result', 'failed', {
        error: err.message || 'Free report delivery failed',
        deliveryMode: options.manual ? 'manual_click' : 'automatic_completion'
      });
    });
}

function maybeLaunchCompletionTestMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('testComplete') !== '1') return;
  const providedRecordId = params.get('recordId') || '';
  const allowRealDelivery = params.get('allowRealDelivery') === '1' && !!providedRecordId;
  completionTestMode = !allowRealDelivery;

  clientName = params.get('name') || 'Test Client';
  businessName = params.get('business') || 'Prairie Hearth Bakery';
  clientEmail = params.get('email') || 'demo@bridgetoai.test';
  businessCategory = params.get('category') || 'Food / Beverage / Manufacturing';
  companySize = params.get('size') || '1-5';
  ownerWorkStatus = params.get('ownerStatus') || 'Full-time owner/operator';
  departments = ['Operations', 'Sales', 'Admin'];
  privacyConsent = true;
  privacyConsentAt = new Date().toISOString();
  btaiFollowupInterest = 'maybe';
  btaiFollowupInterestAt = new Date().toISOString();
  clientDraftId = providedRecordId || `completion_test_${Date.now()}`;
  lastSecureStorage = { saved: true, outputId: allowRealDelivery ? 'existing-secure-record' : 'completion-test-only', reason: allowRealDelivery ? 'Real delivery test mode using an existing Record ID' : 'Completion page test mode only' };

  initCampaignContext();
  showScreen('screen-complete');
  document.getElementById('complete-message').textContent =
    allowRealDelivery
      ? `Thank you, ${clientName}. This is real delivery test mode using an existing secure Record ID. Click "Email my free report" to test report delivery without retaking the interview.`
      : (activePartnerProfile()?.completion || `Thank you, ${clientName}. This is completion-page test mode. No interview was submitted and no report email was sent.`);
  const status = document.getElementById('followup-save-status');
  if (status) status.textContent = allowRealDelivery ? 'Real delivery test mode: no email sent until you click the button.' : 'Test mode: no report email sent.';
  const deliveryButton = document.getElementById('report-delivery-btn');
  if (deliveryButton && !allowRealDelivery) {
    deliveryButton.textContent = 'Test mode only - no report to send';
    deliveryButton.disabled = true;
  } else if (deliveryButton) {
    deliveryButton.textContent = 'Email my free report';
    deliveryButton.disabled = false;
  }
  logHermesEvent('completion_page_test_mode_loaded', 'info', {
    partner: campaignPartner,
    campaign: campaignId,
    allowRealDelivery
  });
}
initCampaignContext();
maybeContinueDeepInterviewFromLink().then(handled => {
  if (!handled) maybeLaunchCompletionTestMode();
});
</script>
</body>
</html>
```

### lib/identity-redaction.js

```javascript
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
  return [surface, name, String(name).toUpperCase(), ...(hasInitial ? [] : parts.flatMap(part => [part, part.toUpperCase()]))].filter(Boolean);
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
    if (ownerParts[0]) {
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
```

### lib/privacy.js

```javascript
import { buildIdentityRegistry, redactForModel, reidentify } from './identity-redaction.js';

export function anonymizeText(text, explicit = {}) {
  const participantText = Object.hasOwn(explicit, 'participantText') ? explicit.participantText : text;
  const result = redactForModel(text, buildIdentityRegistry({ identity: explicit, declaredPeople: explicit.declaredPeople, participantText }));
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
```

### lib/supabase-rest.js

```javascript
function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return { url, key };
}

export function supabaseConfigured() {
  return !!(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

async function request(path, options = {}) {
  const { url, key } = config();
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase request failed ${resp.status}: ${text}`);
  }

  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

function eq(value) {
  return encodeURIComponent(`eq.${value}`);
}

export async function upsertIntakeSession(row) {
  const data = await request('intake_sessions?on_conflict=client_draft_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function getIntakeSession(clientDraftId) {
  const data = await request(`intake_sessions?client_draft_id=${eq(clientDraftId)}&select=*`, {
    method: 'GET'
  });
  return Array.isArray(data) ? data[0] || null : null;
}

export async function getRecentIntakeSessions({ limit = 100, status = '', days = 120 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const safeDays = Math.max(1, Math.min(Number(days) || 120, 1095));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const filters = [
    `created_at=gte.${encodeURIComponent(since)}`,
    'select=*',
    'order=created_at.desc',
    `limit=${safeLimit}`
  ];
  const safeStatus = String(status || '').trim();
  if (safeStatus && safeStatus.toLowerCase() !== 'all') {
    filters.unshift(`status=${eq(safeStatus)}`);
  }
  const data = await request(`intake_sessions?${filters.join('&')}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

export async function updateIntakeSession(clientDraftId, patch) {
  const data = await request(`intake_sessions?client_draft_id=${eq(clientDraftId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  return Array.isArray(data) ? data[0] || null : data;
}

export async function insertIntakeOutput(row) {
  const data = await request('intake_outputs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function insertIntakeEvent(row) {
  const data = await request('intake_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function insertClaimTrace(row) {
  const data = await request('claim_trace', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function getLatestIntakeOutput(clientDraftId, outputType = 'venture_dna_markdown') {
  const data = await request(
    `intake_outputs?client_draft_id=${eq(clientDraftId)}&output_type=${eq(outputType)}&select=*&order=created_at.desc&limit=1`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data[0] || null : null;
}

export async function getIntakeOutputById(outputId, { clientDraftId = '', outputType = '' } = {}) {
  if (!outputId) return null;
  const filters = [`id=${eq(outputId)}`, 'select=*', 'limit=1'];
  if (clientDraftId) filters.unshift(`client_draft_id=${eq(clientDraftId)}`);
  if (outputType) filters.unshift(`output_type=${eq(outputType)}`);
  const data = await request(`intake_outputs?${filters.join('&')}`, { method: 'GET' });
  return Array.isArray(data) ? data[0] || null : null;
}

export async function getIntakeEvents(clientDraftId, limit = 80) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));
  const data = await request(
    `intake_events?client_draft_id=${eq(clientDraftId)}&select=*&order=created_at.asc&limit=${safeLimit}`,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data : [];
}

export async function getPartnerKpiEvents({ partner = 'AFPA', campaign = '', days = 120, limit = 5000 } = {}) {
  const safePartner = String(partner || 'AFPA').trim();
  const safeCampaign = String(campaign || '').trim();
  const safeDays = Math.max(1, Math.min(Number(days) || 120, 1095));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const filters = [
    `partner=${eq(safePartner)}`,
    `created_at=gte.${encodeURIComponent(since)}`,
    'select=*',
    'order=created_at.desc',
    `limit=${safeLimit}`
  ];
  if (safeCampaign && safeCampaign.toLowerCase() !== 'all') {
    filters.unshift(`campaign=${eq(safeCampaign)}`);
  }
  const data = await request(`intake_kpi_events?${filters.join('&')}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}
```

### lib/privacy-gate.js

```javascript
import crypto from 'crypto';

const GATE_VERSION = 'privacy-gate-v1.1.0';

const CATEGORY_META = {
  direct_identifier: {
    label: 'Direct identifier',
    severity: 'medium',
    action: 'redact'
  },
  government_id: {
    label: 'Government ID',
    severity: 'high',
    action: 'quarantine'
  },
  payment_card: {
    label: 'Payment card',
    severity: 'high',
    action: 'quarantine'
  },
  bank_account: {
    label: 'Banking or financial account detail',
    severity: 'high',
    action: 'quarantine'
  },
  clinical: {
    label: 'Clinical or regulated health detail',
    severity: 'high',
    action: 'quarantine'
  },
  payroll: {
    label: 'Payroll or employee compensation topic',
    severity: 'low',
    action: 'context'
  },
  payroll_amount: {
    label: 'Payroll or compensation amount',
    severity: 'medium',
    action: 'generalize'
  },
  person_name: {
    label: 'Person name near sensitive context',
    severity: 'medium',
    action: 'tokenize'
  },
  customer_list: {
    label: 'Customer list or private customer data',
    severity: 'high',
    action: 'quarantine'
  },
  contract: {
    label: 'Supplier/customer contract detail',
    severity: 'high',
    action: 'quarantine'
  },
  invoice: {
    label: 'Invoice or private transaction detail',
    severity: 'medium',
    action: 'redact'
  },
  recipe_formula: {
    label: 'Recipe, formula, or confidential process',
    severity: 'high',
    action: 'quarantine'
  },
  confidential: {
    label: 'Confidential operating detail',
    severity: 'medium',
    action: 'redact'
  }
};

const KEYWORD_RULES = [
  {
    category: 'bank_account',
    pattern: /\b(?:bank account|account number|routing number|wire transfer|void cheque|void check|transit number|institution number|iban|swift|eft|ach)\b/gi
  },
  {
    category: 'clinical',
    pattern: /\b(?:patient|diagnosis|diagnosed|medication|prescription|medical record|chart note|clinical|clinic|doctor|physician|nurse practitioner|treatment plan|health card|lab result|hipaa|phipa)\b/gi
  },
  {
    category: 'payroll',
    pattern: /\b(?:payroll|salary|salaries|wage|wages|hourly rate|employee pay|compensation|pay stub|paycheque|paycheck|t4|w-2|roe|benefits deduction|commission statement)\b/gi
  },
  {
    category: 'customer_list',
    pattern: /\b(?:customer list|client list|patient list|member list|subscriber list|customer names|client names|customer emails|client emails)\b/gi
  },
  {
    category: 'contract',
    pattern: /\b(?:supplier contract|customer contract|vendor contract|nda|non-disclosure|terms sheet|master service agreement|msa|confidential agreement)\b/gi
  },
  {
    category: 'invoice',
    pattern: /\b(?:invoice|invoice number|purchase order|po number|payment terms|accounts receivable|accounts payable)\b/gi
  },
  {
    category: 'recipe_formula',
    pattern: /\b(?:recipe|formula|formulation|ingredient ratio|secret sauce|proprietary blend|confidential process|batch sheet|production formula)\b/gi
  },
  {
    category: 'confidential',
    pattern: /\b(?:confidential|private financials|trade secret|proprietary|do not share|restricted data|sensitive file)\b/gi
  }
];

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function luhnValid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function excerptFor(text, start, end) {
  const source = String(text || '');
  const left = Math.max(0, start - 42);
  const right = Math.min(source.length, end + 42);
  return source.slice(left, right).replace(/\s+/g, ' ').trim();
}


function sentenceBounds(source, start, end) {
  const leftCandidates = [source.lastIndexOf('.', start), source.lastIndexOf('!', start), source.lastIndexOf('?', start), source.lastIndexOf('\n', start)];
  const left = Math.max(...leftCandidates) + 1;
  const rightCandidates = ['.', '!', '?', '\n']
    .map(mark => {
      const index = source.indexOf(mark, end);
      return index === -1 ? source.length : index;
    });
  const right = Math.min(...rightCandidates, source.length);
  return { left: Math.max(0, left), right: Math.min(source.length, right + 1) };
}

function nearbyText(source, start, end, radius = 90) {
  return source.slice(Math.max(0, start - radius), Math.min(source.length, end + radius));
}

function hasSensitivePayrollContext(text) {
  return /\b(?:payroll|salary|salaries|wage|wages|hourly rate|employee pay|compensation|pay stub|paycheque|paycheck|t4|w-2|roe|benefits deduction|commission statement)\b/i.test(String(text || ''));
}

function hasHardPayrollRecordContext(text) {
  return /\b(?:pay stub|paycheque|paycheck|t4|w-2|roe|payroll list|payroll table|payroll spreadsheet|employee wage record|wage record|deduction|garnishment|tax slip)\b/i.test(String(text || ''));
}

function hasBoundaryContext(text) {
  return /\b(?:do not|don't|should not|shouldn't|never|avoid|keep away|not touch|human review|stay human|off limits|boundary|approval)\b/i.test(String(text || ''));
}

function parseMoneyAmount(value) {
  const raw = String(value || '').toLowerCase();
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  let amount = Number(digits);
  if (!Number.isFinite(amount)) return null;
  if (/\bk\b/.test(raw)) amount *= 1000;
  if (/\b(?:m|million)\b/.test(raw)) amount *= 1000000;
  return amount;
}

function amountBand(value) {
  const amount = parseMoneyAmount(value);
  if (!amount) return 'APPROX_AMOUNT';
  if (amount < 1000) return 'LESS_THAN_1K';
  if (amount < 10000) return 'LOW_FOUR_FIGURES';
  if (amount < 50000) return 'TENS_OF_THOUSANDS';
  if (amount < 100000) return 'HIGH_FIVE_FIGURES';
  if (amount < 1000000) return 'SIX_FIGURES';
  if (amount < 10000000) return 'SEVEN_FIGURES';
  return 'EIGHT_PLUS_FIGURES';
}

function isExactSoundingAmount(value) {
  const raw = String(value || '');
  if (/\.\d{2}\b/.test(raw)) return true;
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length < 4) return false;
  return !/0{2,}$/.test(digitsOnly);
}

function addContextFinding(findings, category, match, start, end, source, kind, overrides = {}) {
  findings.push({
    ...finding(category, match, start, end, source, kind),
    ...overrides
  });
}
function finding(category, match, start, end, sourceText, kind = 'pattern') {
  const meta = CATEGORY_META[category] || CATEGORY_META.confidential;
  return {
    id: `${category}_${start}_${end}_${hashValue(match).slice(0, 10)}`,
    category,
    label: meta.label,
    severity: meta.severity,
    action: meta.action,
    matchType: kind,
    start,
    end,
    length: end - start,
    valueHash: hashValue(match),
    contextPreview: excerptFor(sourceText, start, end)
  };
}

function collectPatternFindings(text) {
  const source = String(text || '');
  const findings = [];

  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const match of source.matchAll(emailRe)) {
    findings.push(finding('direct_identifier', match[0], match.index, match.index + match[0].length, source, 'email'));
  }

  const phoneRe = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
  for (const match of source.matchAll(phoneRe)) {
    findings.push(finding('direct_identifier', match[0], match.index, match.index + match[0].length, source, 'phone'));
  }

  const cardRe = /\b(?:\d[ -]*?){13,19}\b/g;
  for (const match of source.matchAll(cardRe)) {
    if (luhnValid(match[0])) {
      findings.push(finding('payment_card', match[0], match.index, match.index + match[0].length, source, 'luhn_payment_card'));
    } else {
      findings.push(finding('bank_account', match[0], match.index, match.index + match[0].length, source, 'long_account_like_number'));
    }
  }

  const sinSsnRe = /\b(?:\d{3}[-\s]?\d{2}[-\s]?\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/g;
  for (const match of source.matchAll(sinSsnRe)) {
    findings.push(finding('government_id', match[0], match.index, match.index + match[0].length, source, 'sin_ssn_like_number'));
  }

  for (const rule of KEYWORD_RULES) {
    for (const match of source.matchAll(rule.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const context = nearbyText(source, start, end);
      if (rule.category === 'payroll') {
        if (hasBoundaryContext(context)) {
          addContextFinding(findings, 'payroll', match[0], start, end, source, 'boundary_keyword', {
            severity: 'low',
            action: 'context'
          });
        } else if (hasHardPayrollRecordContext(context)) {
          addContextFinding(findings, 'payroll', match[0], start, end, source, 'payroll_record_keyword', {
            severity: 'high',
            action: 'quarantine'
          });
        } else {
          addContextFinding(findings, 'payroll', match[0], start, end, source, 'business_context_keyword', {
            severity: 'low',
            action: 'context'
          });
        }
      } else {
        findings.push(finding(rule.category, match[0], start, end, source, 'keyword'));
      }
    }
  }

  const moneyRe = /(?:\$\s*)?\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|(?:\$\s*)?\b\d+(?:\.\d{2})?\s*(?:k|m|million)\b/gi;
  for (const match of source.matchAll(moneyRe)) {
    const start = match.index;
    const end = start + match[0].length;
    const context = nearbyText(source, start, end);
    if (!hasSensitivePayrollContext(context)) continue;
    if (hasBoundaryContext(context)) continue;
    const band = amountBand(match[0]);
    addContextFinding(findings, 'payroll_amount', match[0], start, end, source, isExactSoundingAmount(match[0]) ? 'exact_payroll_amount' : 'rounded_payroll_amount', {
      severity: 'medium',
      action: 'generalize',
      sanitizedValue: `[GENERALIZED_PAYROLL_AMOUNT_${band}]`
    });
  }

  const nameRe = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  for (const match of source.matchAll(nameRe)) {
    const start = match.index;
    const end = start + match[0].length;
    const context = nearbyText(source, start, end);
    if (!hasSensitivePayrollContext(context)) continue;
    if (hasBoundaryContext(context)) continue;
    addContextFinding(findings, 'person_name', match[0], start, end, source, 'person_name_near_payroll', {
      severity: hasHardPayrollRecordContext(context) ? 'high' : 'medium',
      action: hasHardPayrollRecordContext(context) ? 'quarantine' : 'tokenize',
      sanitizedValue: '[ANONYMIZED_PERSON]'
    });
  }

  return resolveOverlappingFindings(dedupeFindings(findings));
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter(item => {
    const key = `${item.category}:${item.start}:${item.end}:${item.valueHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start - b.start || b.end - a.end);
}

function severityRank(value) {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function resolveOverlappingFindings(findings) {
  const ranked = [...findings].sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity);
    if (severity) return severity;
    const length = b.length - a.length;
    if (length) return length;
    return a.start - b.start;
  });
  const accepted = [];

  for (const item of ranked) {
    const overlaps = accepted.some(existing => item.start < existing.end && item.end > existing.start);
    if (!overlaps) accepted.push(item);
  }

  return accepted.sort((a, b) => a.start - b.start || b.end - a.end);
}

function redactText(text, findings) {
  let output = String(text || '');
  const redactionMap = [];
  const redactionFindings = findings.filter(item => item.action !== 'context');
  const counters = {};
  const tokenById = new Map();

  for (const item of [...redactionFindings].sort((a, b) => a.start - b.start)) {
    counters[item.category] = (counters[item.category] || 0) + 1;
    const token = item.sanitizedValue || ('[REDACTED_' + item.category.toUpperCase() + '_' + counters[item.category] + ']');
    const original = String(text || '').slice(item.start, item.end);
    tokenById.set(item.id, token);
    redactionMap.push({
      token,
      category: item.category,
      label: item.label,
      severity: item.severity,
      action: item.action,
      original,
      originalHash: hashValue(original)
    });
  }

  const ordered = [...redactionFindings].sort((a, b) => b.start - a.start);
  for (const item of ordered) {
    const token = tokenById.get(item.id);
    output = output.slice(0, item.start) + token + output.slice(item.end);
  }

  return {
    sanitizedText: output,
    redactionMap
  };
}

function riskSummary(findings) {
  const categories = {};
  let high = 0;
  let medium = 0;
  for (const item of findings) {
    categories[item.category] = (categories[item.category] || 0) + 1;
    if (item.severity === 'high') high++;
    if (item.severity === 'medium') medium++;
  }
  const riskLevel = high ? 'high' : medium ? 'medium' : 'low';
  return {
    riskLevel,
    findingCount: findings.length,
    highRiskCount: high,
    mediumRiskCount: medium,
    categories
  };
}

function proofFindings(findings) {
  return findings.map(item => ({
    id: item.id,
    category: item.category,
    label: item.label,
    severity: item.severity,
    action: item.action,
    matchType: item.matchType,
    length: item.length,
    valueHash: item.valueHash,
    contextPreview: item.contextPreview
  }));
}

export function runPrivacyGate(text, options = {}) {
  const source = String(text || '');
  const purpose = String(options.purpose || 'ai_payload');
  const mode = String(process.env.BTAI_PRIVACY_GATE_MODE || options.mode || 'quarantine-high').toLowerCase();
  const findings = collectPatternFindings(source);
  const summary = riskSummary(findings);
  const redacted = redactText(source, findings);
  const hardStopCount = findings.filter(item => item.action === 'quarantine').length;
  const requiresReview = hardStopCount > 0 && mode !== 'sanitize-only';
  const decision = requiresReview ? 'quarantine' : 'allow_sanitized';

  return {
    gateVersion: GATE_VERSION,
    purpose,
    scannedAt: new Date().toISOString(),
    mode,
    decision,
    requiresReview,
    originalHash: hashValue(source),
    sanitizedHash: hashValue(redacted.sanitizedText),
    sanitizedText: redacted.sanitizedText,
    findings,
    proofFindings: proofFindings(findings),
    redactionMap: redacted.redactionMap,
    summary: {
      ...summary,
      hardStopCount
    }
  };
}

export function gateProofDetails(result, extra = {}) {
  return {
    privacyGateVersion: result.gateVersion,
    privacyProofType: 'privacy_gate',
    privacyGatePurpose: result.purpose,
    privacyGateDecision: result.decision,
    privacyGateRiskLevel: result.summary.riskLevel,
    privacyGateFindingCount: result.summary.findingCount,
    privacyGateHighRiskCount: result.summary.highRiskCount,
    privacyGateMediumRiskCount: result.summary.mediumRiskCount,
    privacyGateHardStopCount: result.summary.hardStopCount || 0,
    privacyGateCategories: result.summary.categories,
    sanitizedAiPayloadCreated: true,
    redactionMapStoredEncrypted: true,
    rawSourcePreservedEncrypted: true,
    aiReceivesSanitizedPayloadOnly: result.decision !== 'quarantine',
    requiresAdminReview: result.requiresReview,
    proofStatus: result.decision === 'quarantine' ? 'review_required' : 'passed',
    ...extra
  };
}

export function publicGateSummary(result) {
  return {
    gateVersion: result.gateVersion,
    purpose: result.purpose,
    scannedAt: result.scannedAt,
    decision: result.decision,
    requiresReview: result.requiresReview,
    summary: result.summary,
    findings: result.proofFindings
  };
}
```

### lib/security.js

```javascript
import crypto from 'crypto';

function headerValue(req, name) {
  return req.headers?.[name] || req.headers?.[name.toLowerCase()] || '';
}

export function assertTrustedOrigin(req) {
  const origin = headerValue(req, 'origin');
  if (!origin) return;

  const host = headerValue(req, 'host');
  let sameOrigin = false;
  try {
    const parsed = new URL(origin);
    sameOrigin = !!host && parsed.host === host && ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    sameOrigin = false;
  }
  const allowed = String(process.env.BTAI_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (sameOrigin || allowed.includes(origin.replace(/\/$/, ''))) return;
  const err = new Error('Untrusted request origin');
  err.statusCode = 403;
  throw err;
}

export function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function authorizedAdmin(req) {
  const expected = process.env.BTAI_ADMIN_SECRET;
  if (!expected || String(expected).length < 24) return false;
  const provided = headerValue(req, 'x-btai-admin-secret');
  return timingSafeEqualText(provided, expected);
}

export function bearerToken(req) {
  const authorization = headerValue(req, 'authorization');
  const match = String(authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function getSupabaseUser(accessToken) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !accessToken) return null;
  const resp = await fetch(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function getAdminProfile(userId) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return null;
  const resp = await fetch(`${url}/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  if (!resp.ok) return null;
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function authorizedAdminAccount(req) {
  const token = bearerToken(req);
  const claims = decodeJwtPayload(token);
  if (!claims || claims.aal !== 'aal2') return false;
  const user = await getSupabaseUser(token);
  const appMeta = user?.app_metadata || {};
  const appAdmin = !!(user?.id && (appMeta.btai_admin === true || appMeta.role === 'btai_admin'));
  if (!appAdmin) return false;
  const profile = await getAdminProfile(user.id);
  return !profile || profile.active === true;
}

export async function authorizedAdminRequest(req) {
  if (await authorizedAdminAccount(req)) return true;
  const emergencyEnabled = String(process.env.BTAI_ENABLE_EMERGENCY_ADMIN_SECRET || '').toLowerCase() === 'true';
  return emergencyEnabled && authorizedAdmin(req);
}

const rateBuckets = new Map();

export function assertRateLimit(req, { key = 'global', limit = 30, windowMs = 60_000 } = {}) {
  const ip = headerValue(req, 'x-forwarded-for').split(',')[0].trim() || headerValue(req, 'x-real-ip') || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count <= limit) return;
  const err = new Error('Too many requests');
  err.statusCode = 429;
  throw err;
}

export async function assertTurnstile(req, token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  const response = String(token || req.body?.turnstileToken || '').trim();
  if (!response) {
    const err = new Error('Human verification required');
    err.statusCode = 403;
    throw err;
  }
  const remoteip = headerValue(req, 'x-forwarded-for').split(',')[0].trim();
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      response,
      remoteip: remoteip || undefined
    })
  });
  const data = await verification.json().catch(() => ({}));
  if (data.success) return;
  const err = new Error('Human verification failed');
  err.statusCode = 403;
  throw err;
}

export function safeError(res, err, fallback = 'Server error') {
  const status = Number(err?.statusCode) || 500;
  return res.status(status).json({
    error: status === 500 ? fallback : err.message
  });
}
```

### lib/draft-access.js

```javascript
import crypto from 'crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_DAYS = 30;

function secret() {
  const value = String(process.env.BTAI_DRAFT_ACCESS_SECRET || '');
  if (value.length < 32) {
    const err = new Error('Draft access is not configured');
    err.statusCode = 503;
    throw err;
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function sameSignature(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function issueDraftAccess(clientDraftId, { ttlDays = DEFAULT_TTL_DAYS } = {}) {
  const id = String(clientDraftId || '').trim();
  if (!id) throw new Error('Missing clientDraftId');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ v: TOKEN_VERSION, id, iat: now, exp: now + (ttlDays * 24 * 60 * 60) });
  return `${payload}.${sign(payload)}`;
}

export function assertDraftAccess(token, clientDraftId) {
  const [encoded, signature, ...extra] = String(token || '').split('.');
  const id = String(clientDraftId || '').trim();
  const payload = !extra.length && encoded && signature && sameSignature(signature, sign(encoded)) ? decode(encoded) : null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.v !== TOKEN_VERSION || payload.id !== id || !Number.isInteger(payload.exp) || payload.exp <= now) {
    const err = new Error('Draft access is invalid or expired');
    err.statusCode = 403;
    throw err;
  }
  return payload;
}
```

### scripts/identity-redaction-test.mjs

```javascript
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
```

### scripts/adaptive-probe-contract-test.mjs

```javascript
#!/usr/bin/env node

import assert from 'node:assert/strict';
import { probe, masteryFollowup } from '../api/interview-ai.js';

const originalFetch = globalThis.fetch;
let capturedModelBody = '';
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    content: [{ text: JSON.stringify({
      ask_followup: true,
      question_type: 'clarify',
      domain: 'Workflow Friction',
      question: 'About how often does that delay happen in a typical week?',
      why_needed: 'Frequency is missing.',
      sensitivity_level: 'low',
      uses_approved_category: true
    }) }]
  })
});

try {
  const result = await probe({
    domain: 'Workflow Friction',
    qa: 'Question: Where does work slow down?\nAnswer: Sometimes it is slow.',
    businessNiche: 'bookkeeping practice',
    companySize: '6-10',
    sourceQuestionType: 'Bottleneck'
  });
  assert.equal(typeof result.followup, 'object', 'a well-formed model response is parsed into a follow-up object');
  assert.equal(result.followup.ask_followup, true, 'the parsed follow-up preserves the model decision');
  assert.match(result.followup.question, /how often/i, 'the parsed follow-up preserves the model question');

  globalThis.fetch = async (_url, options) => {
    capturedModelBody = options.body;
    return { ok: true, json: async () => ({ content: [{ text: JSON.stringify({ ask_followup: false, question: '' }) }] }) };
  };
  await probe({
    domain: 'Workflow Friction',
    qa: 'Question: What slows down?\nAnswer: Darren Randles at Acme Foods emails owner@example.test.',
    businessNiche: 'Acme Foods',
    identity: { clientName: 'Darren Randles', businessName: 'Acme Foods', clientEmail: 'owner@example.test' }
  });
  assert.doesNotMatch(capturedModelBody, /Darren Randles|Acme Foods|owner@example\.test/i, 'the model-bound probe request excludes known owner, business, and email values');
  assert.match(capturedModelBody, /\[OWNER_NAME\]|\[PERSON_1\]/, 'the model-bound probe request contains placeholders instead');

  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('A quarantined probe must not call the model'); };
  const quarantined = await probe({
    domain: 'Workflow Friction',
    qa: 'Question: What slows down?\nAnswer: Our customer list contains private names and emails.',
    businessNiche: 'bookkeeping practice'
  });
  assert.equal(quarantined.followup, 'NONE', 'a sensitive probe answer is skipped');
  assert.equal(called, false, 'a sensitive probe answer does not reach the model');

  capturedModelBody = '';
  globalThis.fetch = async (_url, options) => {
    capturedModelBody = options.body;
    return { ok: true, json: async () => ({ content: [{ text: 'What would change if that step were easier?' }] }) };
  };
  await masteryFollowup({
    area: 'payroll review',
    answer: 'Darren Randles checks the $8,250 payroll adjustment with Sarah Nguyen.',
    businessNiche: 'bookkeeping practice',
    identity: { clientName: 'Darren Randles' }
  });
  assert.doesNotMatch(capturedModelBody, /Darren Randles|Sarah Nguyen|8,250/i, 'the mastery model request excludes raw names and sensitive amount');
  assert.match(capturedModelBody, /\[ANONYMIZED_PERSON\]|\[OWNER_NAME\]|\[PERSON_DETECTED_1\]/, 'the mastery request contains identity placeholders');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('adaptive probe contract tests passed');
```

### scripts/generate-dna-anonymization-test.mjs

```javascript
#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt } from '../api/generate-dna.js';

const current = anonymizePrompt('Business Description: tax prep for self-employed contractors');
assert.equal(current.mapping['[BUSINESS_DESCRIPTION]'], 'tax prep for self-employed contractors', 'the primary report path tokenizes the current business-description label');
assert.doesNotMatch(current.anonymizedPrompt, /tax prep for self-employed contractors/i, 'the primary report path removes the current description before model analysis');

const legacy = anonymizePrompt('Business Category: Professional Services');
assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Professional Services', 'the primary report path still tokenizes the legacy label');

const template = '### Revenue Engine\n## Quick Read\nGoogle Drive is used for planning.\nParticipant answer: Sarah Nguyen called.';
const participant = 'Sarah Nguyen called.';
const participantOnly = anonymizePrompt(template, participant);
assert.match(participantOnly.anonymizedPrompt, /Revenue Engine|Quick Read|Google Drive/, 'template headings and common tools are not scanned as participant names');
assert.doesNotMatch(participantOnly.anonymizedPrompt, /Sarah|Nguyen/i, 'participant names are replaced before the DNA model request');

const noParticipant = anonymizePrompt(template, '');
assert.match(noParticipant.anonymizedPrompt, /Revenue Engine|Quick Read/, 'an empty participant-text value disables heuristic template scanning');

console.log('generate-dna anonymization tests passed');
```

### scripts/recover-dna-anonymization-test.mjs

```javascript
#!/usr/bin/env node

import assert from 'node:assert/strict';
import { anonymizePrompt, buildRecoveryPrompt } from '../api/recover-dna.js';

const current = anonymizePrompt([
  'Owner Name: Test Owner',
  'Business Name: Test Business',
  'Business Description: bookkeeping practice',
  'Website URL: https://example.test'
].join('\n'));

assert.equal(current.mapping['[BUSINESS_DESCRIPTION]'], 'bookkeeping practice', 'the current business-description label is tokenized');
assert.doesNotMatch(current.anonymizedPrompt, /bookkeeping practice/i, 'the current description is removed from the anonymized prompt');

const legacy = anonymizePrompt('Business Category: Bakery / Grains');
assert.equal(legacy.mapping['[BUSINESS_DESCRIPTION]'], 'Bakery / Grains', 'the legacy business-category label remains tokenized');

const recoveryPrompt = buildRecoveryPrompt({
  clientName: 'Test Owner',
  businessName: 'Test Business',
  businessNiche: 'bookkeeping practice',
  answers: []
}, 'test-record');
const recoveryResult = anonymizePrompt(recoveryPrompt);
assert.equal(recoveryResult.mapping['[BUSINESS_DESCRIPTION]'], 'bookkeeping practice', 'the real recovery template feeds its description to the anonymizer');
assert.doesNotMatch(recoveryResult.anonymizedPrompt, /bookkeeping practice/i, 'the real recovery template does not expose the description to model analysis');

const participantRecovery = anonymizePrompt('## Customer Service\nSarah Nguyen called.', 'Sarah Nguyen called.');
assert.match(participantRecovery.anonymizedPrompt, /Customer Service/, 'recovery templates are not scanned as participant answers');
assert.doesNotMatch(participantRecovery.anonymizedPrompt, /Sarah|Nguyen/i, 'recovery participant names are replaced');

console.log('recover-dna anonymization tests passed');
```

### scripts/report-identity-redaction-contract-test.mjs

```javascript
#!/usr/bin/env node

import assert from 'node:assert/strict';
import { callClaude } from '../api/report-pack.js';
import { reidentify, retokenizeWithMapping } from '../lib/identity-redaction.js';
import { getIntakeOutputById } from '../lib/supabase-rest.js';

const mapping = {
  '[OWNER_NAME]': 'Darren Randles',
  '[BUSINESS_NAME]': 'Acme Foods',
  '[EMAIL_1]': 'owner@example.test',
  '[WEBSITE_URL]': 'https://acme.example.test'
};
const rawDna = 'Darren Randles runs Acme Foods. Contact owner@example.test or https://acme.example.test.';
const tokenized = retokenizeWithMapping(rawDna, mapping);
assert.doesNotMatch(tokenized, /Darren Randles|Acme Foods|owner@example\.test|acme\.example\.test/i, 'report source is retokenized before model analysis');

const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SECRET_KEY;
let captured = '';
process.env.ANTHROPIC_API_KEY = 'synthetic-test-key';
globalThis.fetch = async (_url, options) => {
  captured = options.body;
  return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Report for [OWNER_NAME] at [BUSINESS_NAME].' }] }) };
};
try {
  const modelOutput = await callClaude(tokenized, 100);
  assert.doesNotMatch(captured, /Darren Randles|Acme Foods|owner@example\.test|acme\.example\.test/i, 'captured model request contains no raw identifiers');
  assert.match(captured, /\[OWNER_NAME\]|\[BUSINESS_NAME\]/, 'captured model request uses placeholders');
  assert.equal(reidentify(modelOutput, mapping), 'Report for Darren Randles at Acme Foods.', 'participant report restores placeholders after model output');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
}

let scopedUrl = '';
process.env.SUPABASE_URL = 'https://example.supabase.test';
process.env.SUPABASE_SECRET_KEY = 'synthetic-supabase-key';
globalThis.fetch = async url => {
  scopedUrl = String(url);
  return { ok: true, status: 200, text: async () => '[]' };
};
try {
  await getIntakeOutputById('mapping-1', { clientDraftId: 'draft-1', outputType: 'hermes_reidentification_map' });
  assert.match(scopedUrl, /client_draft_id=eq.draft-1/, 'map lookup is scoped to its draft');
  assert.match(scopedUrl, /output_type=eq.hermes_reidentification_map/, 'map lookup is scoped to the re-identification output type');
} finally {
  globalThis.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSupabaseKey;
}

console.log('report identity redaction contract tests passed');
```

### docs/releases/v1.72.32/README.md

```markdown
# BTAI Intake v1.72.32 — identity-boundary corrective candidate

## Release boundary

Private Preview candidate only. Production remains v1.72.23 on `main`. This
candidate does not alter report delivery, email gates, credentials, AI
enablement, access controls, or wider tester access.

## Corrective scope

This candidate responds to the independent v1.72.31 review:

- A detected third-party name is tokenized in its full-name, first-name,
  surname, and all-caps forms.
- A bare owner first name is marked ambiguous rather than being restored as the
  owner. Declared people with an initial, such as `Darren M.`, keep a separate
  token.
- Multi-word known names match case-insensitively; a lower-case ordinary word
  does not become a name match.
- An explicitly empty participant-text value disables heuristic detection, so
  generated prompt headings cannot be mistaken for participant names.
- The report-map test now asserts draft-ID and output-type query scoping.

## Release gate

Do not widen testers until Claude independently reviews the complete v1.72.32
packet. This is a heuristic privacy layer, not a claim of perfect identity
detection or a legal privacy conclusion.
```

