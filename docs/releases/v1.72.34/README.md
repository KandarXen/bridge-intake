# BTAI Intake v1.72.34 — privacy-gate false-positive correction

## What this build fixes

A normal Snapshot could be stopped with “Privacy review required before report
delivery” even when the participant supplied only general business information.
The assembled AI prompt includes Bridge To AI's own instructions such as “do not
include payroll, confidential details, customer lists, contracts, or invoices.”
The previous gate treated those static instructions as if they had been supplied
by the participant.

## Correct behaviour

- The full assembled prompt is still scanned and sanitized before it reaches an
  AI provider.
- Only sensitive findings in the separately captured participant answer source
  can place an intake into privacy review.
- A prompt-only finding caused by BTAI's static safety text is recorded as a
  sanitized audit event, but does not block a general Snapshot or report email.
- Actual participant-provided sensitive content remains blocked from automatic
  report delivery.

## Verification

`scripts/privacy-gate-context-test.mjs` covers both cases above. Run it with:

```powershell
node scripts/privacy-gate-context-test.mjs
```

This is a Preview corrective build. It does not enable Production deployment or
change the automatic completion-notification switch.
