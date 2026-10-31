# BTAI Intake v1.72.30 — Identity Redaction Standard

## Release boundary

Private Preview only. Public Production remains v1.72.23 on `main`. This build does not change AI-enable settings, report delivery, email gating, or access control.

## What changed

- Model-bound text uses a shared identity-redaction module.
- Detected owner, business, email, phone, URL, postal-code, organization, and likely-person identifiers are represented by stable placeholders and restored only after model output.
- DNA outputs reference the exact encrypted re-identification map used for that generation; report generation uses that paired map.
- Optional adaptive and mastery follow-ups are Privacy-Gate screened before a model call.
- Report-stage redaction is recorded separately from DNA-stage redaction.

## Claim standard

Client-facing wording says identifiers are replaced **where detected**. Detection is heuristic and may not catch every name. This is not a legal opinion; the privacy policy requires counsel review before broader commercial use.

## Release gate

Do not publish this build or widen tester access until the full Claude packet contains all required synthetic request-body, report restoration, proof-event, and wording-inventory evidence.
