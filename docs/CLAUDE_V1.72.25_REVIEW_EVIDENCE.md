# Bridge To AI Intake — v1.72.25 Independent Review Evidence

**Baseline:** v1.72.23 public production

**Candidate:** v1.72.25 private Preview

**Candidate commit:** `8bd45a6`

**Candidate branch:** `release/v1.72.24-secure-intake`

**Review posture:** private Preview only. No production deployment is authorized.

## What the reviewer should receive

Attach this document together with the matching `CLAUDE_V1.72.25_REVIEW_DIFF.patch` file. The patch contains the relevant code changes from the public-production baseline through the v1.72.25 candidate.

Do not use any live service connector, do not send email, and do not activate AI calls as part of this review.

## Candidate intent

The candidate is intended for a small private tester group. It improves draft access control, visible save/recovery feedback, scorecard readability, and feature-switch safety.

Current intended behavior:

- AI generation is enabled only for the private Preview branch.
- Free sample report email delivery is disabled.
- Completion-notification email is disabled.
- The public production site remains on v1.72.23.

## Relevant files in the attached patch

- `lib/draft-access.js` — signed draft capability issue and verification.
- `api/draft.js` — capability checks for save, load, and delete.
- `api/generate-dna.js` — capability, consent, and AI feature switch checks.
- `api/report-pack.js` — capability check and client-report feature switch.
- `api/send-email.js` — completion-notification feature switch.
- `index.html` — browser capability handling, save/recovery feedback, completion flow, and scorecard UI.
- `scripts/pilot-safety-contract-test.mjs` — repeatable no-network safety contract test.
- `scripts/privacy-gate-context-test.mjs` — privacy-gate regression test.
- `docs/V1.72.25_PRIVATE_PREVIEW_SIGNOFF.md` — stated release boundary.

## Test evidence

Run locally against candidate commit `8bd45a6` on 2026-10-29:

```text
pilot safety contract tests passed
privacy gate context tests passed
```

The candidate also passed Node syntax checks for:

```text
api/report-pack.js
api/send-email.js
api/generate-dna.js
the final inline script in index.html
```

Previously observed manual Preview results, using synthetic details:

- Save status visibly confirmed that it was safe to refresh.
- After refresh, the saved draft was restored successfully.
- A load request using a draft ID without the matching capability returned `403: Draft access is invalid or expired`.

## Redacted Preview configuration evidence

Vercel configuration was inspected without decrypting or exposing values.

- `BTAI_ENABLE_AUTOMATED_AI` is configured for Preview only, scoped to `release/v1.72.24-secure-intake`.
- `BTAI_ENABLE_CLIENT_REPORT_PACK` is not configured. The code treats any value other than literal `true` as disabled.
- `BTAI_ENABLE_COMPLETION_NOTIFICATIONS` is not configured. The code treats any value other than literal `true` as disabled.

## Important limitation — do not infer isolation

Preview-versus-production credential separation has **not** been proven. No reviewer should claim that Preview has separate Supabase, Resend, Stripe, or AI credentials from production without separate evidence.

The current low-cost pilot approach assumes synthetic tester data and feature switches that prevent outbound email. If environment separation is required before expanding the tester group, flag it as an important finding rather than assuming it exists.

## Evidence not yet supplied

- An aggregate Resend/provider send count while email features are off.
- A new mobile screenshot from the v1.72.25 Preview.
- A proof that every Preview service credential is distinct from production.

These omissions must be listed as evidence gaps, not treated as passing checks.

## Required review response

Return only evidence-backed findings in these sections:

1. **Blocker**
2. **Important before enabling free-report emails**
3. **Non-blocking observation**

For every finding, identify the file/feature area, why it matters, and the smallest practical fix. End with exactly one recommendation:

- Safe to continue private testing
- Needs fixes before private testing
- Needs fixes before enabling free-report emails
