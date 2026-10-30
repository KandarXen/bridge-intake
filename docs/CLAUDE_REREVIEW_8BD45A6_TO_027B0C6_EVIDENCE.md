# BTAI Intake — Claude Re-review Evidence

## Review range

- Starting commit: `8bd45a6`
- Ending commit: `027b0c6`
- Candidate branch: `release/v1.72.24-secure-intake`
- Public production baseline: v1.72.23 (unchanged)

## Attachments for the reviewer

1. `CLAUDE_REREVIEW_8BD45A6_TO_027B0C6.patch` — focused source diff for the requested re-review range.
2. `../api/send-email.js` — full current completion-notification handler. It is included separately because it did not change in this follow-up range; its feature switch was already present in the earlier reviewed candidate.
3. `private-test-page.html` — also included in the focused patch, provided separately if the review client cannot display added files from a patch.

## Reported local test output

Run against the candidate before the final patch was created:

```text
pilot safety contract tests passed
privacy gate context tests passed
```

The follow-up source changes were also syntax-checked with Node for `api/generate-dna.js`, `api/report-pack.js`, and the inline script in `index.html`.

## Redacted Preview configuration metadata

Observed without decrypting values:

- `BTAI_ENABLE_AUTOMATED_AI`: configured for Preview only and scoped to `release/v1.72.24-secure-intake`.
- `BTAI_ENABLE_CLIENT_REPORT_PACK`: absent; code treats it as disabled.
- `BTAI_ENABLE_COMPLETION_NOTIFICATIONS`: absent; code treats it as disabled.
- `BTAI_PREVIEW_REPORT_RECIPIENTS`: not configured because Preview report delivery remains disabled.
- `BTAI_PUBLIC_BASE_URL`: must be configured before Preview report delivery; the follow-up code fails closed when it is absent.

## Intended re-review focus

Confirm or reject these claims from the supplied code:

1. `api/generate-dna.js` runs the privacy gate on the actual `prompt` before any AI call, and separately scans browser-supplied scan text if it differs.
2. `lib/draft-access.js` defaults capabilities to 30 days.
3. `api/report-pack.js` has no default BCC recipient, requires an explicit Preview recipient allowlist, fails closed if Preview has no public base URL, and omits draft IDs from report-email links and body text.
4. `api/report-pack.js` hides paid/up-sell links unless `BTAI_ENABLE_UPSELL_LINKS` is explicitly true.
5. `api/send-email.js` still requires `BTAI_ENABLE_COMPLETION_NOTIFICATIONS=true`, while `index.html` no longer calls the completion-notification endpoint automatically.
6. `private-test-page.html` is static only: no scripts, tracking, forms, mailto links, or production URL.

## Still-open environment evidence gaps

- Preview credential/service separation from production.
- AI-provider spend limit.
- Preview access controls and tester distribution method.
- Rate-limit storage durability.

These are not represented as resolved code findings.
