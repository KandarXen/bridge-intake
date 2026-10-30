# BTAI Intake v1.72.26 — One-field business description

## Purpose

Remove the food-heavy business-category selector from the private Preview intake. Replace it with one required, plain-language field:

> What does your business do?

## Customer-facing effect

- One fewer question on the welcome screen.
- Examples now suit any business: a contractor, practice, retailer, manufacturer, or another business type.
- The answer is used to select relevant industry guidance and tailor the interview.

## Compatibility and safety

- Existing drafts remain readable. A legacy category is shown as the description only if the saved draft has no newer description.
- The established `businessCategory` field continues to be populated from the new description so existing draft, report, and internal API paths continue to work.
- No email, report-delivery, AI-switch, access-control, or production-deployment setting changes are included.

## Verification

Run:

```powershell
node scripts/intake-business-description-contract-test.mjs
node scripts/pilot-safety-contract-test.mjs
node scripts/privacy-gate-context-test.mjs
```
