# BTAI Intake v1.72.28 — primary-path privacy and adaptive follow-up correction

## Purpose

This private-Preview-only build addresses the substantive findings in Claude's v1.72.27 re-review. It does not authorize Production deployment, changes to report delivery, email delivery, or AI-enable settings.

## Fixed

- The primary `/api/generate-dna` anonymizer now recognizes the current `Business Description` label, with legacy `Business Category` support retained for older saved prompts.
- The client-side solo/no-staff classifier no longer treats words in a business description as evidence of staffing level.
- Adaptive follow-ups now use the existing JSON parser rather than an undefined function; a regression test proves a valid model response becomes a follow-up object.
- The recovery anonymizer test now starts with the real recovery prompt template.
- Internal intake-email wording uses the business description when it is available.
- AI interview context applies the same 160-character description bound as the welcome field.
- `/api/interview-ai` now has same-origin protection and a per-IP request limit, consistent with the other AI-facing routes. It does not receive a draft capability requirement because it is legitimately called before the first draft save is completed.

## R2 evidence

The primary report path was checked specifically for the retired labels:

- `api/generate-dna.js`: current label supported; legacy fallback retained intentionally.
- `lib/privacy.js`: no label-specific business-description extractor; it receives explicit identifiers from its callers.
- `lib/privacy-gate.js`: no label-specific dependency.
- `api/partner-aggregate.js`: the remaining `Business Category` reference is a report-table heading, not an AI prompt or extractor.

The dedicated `generate-dna-anonymization-test.mjs` proves both current and legacy labels are tokenized before model analysis.

## Verification

- Business-description contract test: passed.
- Recovery anonymization test: passed.
- Primary generate-DNA anonymization test: passed.
- Adaptive probe contract test: passed.
- Existing pilot-safety and privacy-gate context tests: passed.

## Environment boundary

- Public Production remains v1.72.23 on `main`.
- This release is limited to the private Preview branch.
