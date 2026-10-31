# BTAI Intake v1.72.29 — probe privacy boundary and R2 addendum

## Purpose

This private-Preview-only build closes the final R2 verification requested by Claude and applies the privacy-preserving option for adaptive follow-up questions. It does not change Production, email/report delivery, or automated-report enablement.

## R2 verification result

Repo-wide search across `api/` and `lib/` for `Business Category`, `Specific Niche`, and `BUSINESS_CATEGORY` found only:

1. `api/generate-dna.js`: intentional legacy fallback after the current `Business Description` extractor.
2. `api/recover-dna.js`: intentional legacy fallback after the current `Business Description` extractor.
3. `api/partner-aggregate.js`: a report-table heading only; it is not a model prompt or extractor.

There are no other label-dependent AI-path extractors.

## Adaptive follow-up privacy decision

Adaptive probes remain available for ordinary short answers. Before a probe can call the AI, its question-and-answer payload is scanned by the Privacy Gate:

- If review is required, no probe text is sent to the model and the interview continues without an optional follow-up.
- If allowed, the model receives only the gate's sanitized text.
- The test suite proves both a valid probe response and the no-AI-call quarantine behavior.

This preserves the free report and normal AI interview experience while preventing a sensitive optional answer from activating an unreviewed model call.

## Additional correction

`researchBusiness` now returns a generic `context_unavailable` marker rather than forwarding an upstream provider error body to the browser.

## Verification

All six established tests passed, including the expanded adaptive-probe test:

- business-description intake contract
- recovery anonymization
- primary generate-DNA anonymization
- adaptive probe contract
- pilot safety contract
- privacy-gate context

## Environment boundary

- Public Production remains v1.72.23 on `main`.
- This release is limited to the private Preview branch.
