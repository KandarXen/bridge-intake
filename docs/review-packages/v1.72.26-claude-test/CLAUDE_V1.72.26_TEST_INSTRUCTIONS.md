# BTAI Intake v1.72.26 — Claude independent test assignment

## Your role

You are the independent release tester and reviewer for this change. Do not edit code, deploy, change Vercel/Supabase/Resend settings, enable email delivery, or submit a completed intake that would call the AI. Review and test only the supplied release candidate.

## Release candidate

- **Version:** v1.72.26 private Preview
- **Commit:** `c81e2fe5cd88af1c459d96c9eaf54fe992ea3eea`
- **Branch:** `release/v1.72.24-secure-intake`
- **Private Preview:** `https://bridge-intake-f8jaqws1s-bridgetoai-projects.vercel.app/snapshot`
- **Baseline commit:** `c899232d39927854ba8053ab07e328e4947fb550`

## Change being tested

The welcome screen previously asked two overlapping questions:

1. A food-heavy **What type of business are you in?** category menu.
2. An optional **Specific Niche** text field.

v1.72.26 replaces them with one required field:

> **What does your business do?**

The answer must still provide enough context to select the appropriate industry guidance and tailor questions. Existing draft/report/API data paths still use the established `businessCategory` field for compatibility; the new description populates it. No change is intended to email delivery, AI feature switches, access control, privacy controls, or Production.

## Review evidence to inspect

Review these exact files and the commit diff from `c899232..c81e2fe`:

- `index.html`
- `api/interview-ai.js`
- `api/recover-dna.js`
- `api/send-email.js`
- `scripts/intake-business-description-contract-test.mjs`
- `docs/releases/v1.72.26/README.md`

If you do not have this repository or the commit diff in your workspace, stop and request the exact files or this command output; do not infer behavior from this brief:

```powershell
git diff c899232d39927854ba8053ab07e328e4947fb550..c81e2fe5cd88af1c459d96c9eaf54fe992ea3eea -- index.html api/interview-ai.js api/recover-dna.js api/send-email.js scripts/intake-business-description-contract-test.mjs docs/releases/v1.72.26/README.md
```

## Required checks

### 1. Welcome-screen clarity

- Confirm the food-specific selector is gone from the rendered markup.
- Confirm there is exactly one visible, required business-description field labelled **What does your business do?**
- Confirm its examples are broad and do not position BTAI as a food-industry-only product.
- Confirm the validation message tells a person what they need to enter.

### 2. Tailoring behavior

- Confirm the single answer is used before any research, scenario, adaptive-probe, and report-generation context is built.
- Confirm industry matching can use the description to select relevant guidance for non-food businesses such as trades, professional services, healthcare/care administration, manufacturing, retail, and general business.
- Confirm a generic description falls safely to general-business guidance rather than pretending specialized knowledge.

### 3. Compatibility and resume behavior

- Confirm a newly saved draft stores a usable business description in the existing `businessCategory`-compatible path.
- Confirm an old draft that has `businessCategory` but no `businessNiche` still displays a useful value in the new field and does not cause a JavaScript error.
- Confirm no remaining JavaScript reads or writes a removed `#business-category` DOM element.

### 4. Safety regression check

- Confirm no change enables automatic completion notifications or report email delivery.
- Confirm no change weakens draft capability checks, privacy gates, or the AI switch.
- Confirm no change targets Production.

### 5. Static tests

Confirm these commands were run and passed, or run them if you have a local review copy:

```powershell
node scripts/intake-business-description-contract-test.mjs
node scripts/pilot-safety-contract-test.mjs
node scripts/privacy-gate-context-test.mjs
```

## Optional browser observation

If you can access the protected private Preview without altering access controls, open the URL above and inspect only the welcome screen. Do not enter personal data, click through the completed flow, trigger an AI call, or request a report email. If the Preview is protected and you cannot access it, say so plainly; do not treat the login page as a product failure.

## Required response format

Return a shareable review with these exact sections:

1. **Release posture:** `Ready for private Preview` / `Not ready` / `Needs evidence`
2. **What was verified**
3. **Blockers**
4. **Important before broader tester use**
5. **Non-blocking observations**
6. **Safety regression result**
7. **Evidence gap, if any**
8. **One recommendation**

For each finding, cite the specific file and line or the precise missing evidence. Do not create speculative findings merely because the old food menu was removed.
