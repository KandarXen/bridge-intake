# BTAI Intake v1.72.25 Independent Review

Oct 29, 2026 · @Darren

BTAI Intake baseline v1.72.23 | Independent Claude review

Candidate: v1.72.25, commit 8bd45a6, private Preview. Reviewed from the supplied evidence document and patch only.

## Review conditions

No connector was used and nothing external was changed. This review covers only the supplied evidence document and patch. The test results ("passed") are as reported and were not re-run by the reviewer. Files outside the patch, such as `lib/security.js`, `lib/supabase-rest.js` and the unchanged parts of `report-pack.js`, were not supplied, so findings that depend on them are marked Unknown. This session has write-capable connectors loaded, so future reviews should run in a read-only or synthetic-data session.

## Blocker

No material blocker found for private Preview testing with report emails disabled.

This holds on the condition that testers use synthetic data only, as the sign-off requires. The basis, all visible in the patch:

- Draft save (existing record), load, delete, AI generation, free-report request and completion notification each verify the signed capability, and a draft ID alone fails with `403`.
- The report-email and completion-notification switches treat anything other than the literal `true` as off, and the checks run before any send.
- The request-supplied report email override is removed, and the old hard-coded notification recipients are gone.
- Notification fields are HTML-escaped, and no live secrets appear in the patch.

## Important before enabling free-report emails

Six findings. Items 4 and 6 also affect testing today, so check them before inviting more testers.

| # | File / feature area | Why it matters | Evidence | Smallest practical fix | Verification test | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `api/report-pack.js`, `sendFreeReportEmail` links | If `BTAI_PUBLIC_BASE_URL` is unset in Preview, email links and logo images point to production, which still runs v1.72.23 without the capability check. The continue link carries only the record ID, while the capability lives in the original browser's storage, so the link returns `403` on any other browser or device and puts a record identifier in an email. | `process.env.BTAI_PUBLIC_BASE_URL \|\| 'https://intake.bridgetoai.ca'`; `continueInterviewUrl` is `${publicBaseUrl}/snapshot?continue=deep&recordId=...`; `loadDraft` sends only the locally stored token; the config evidence lists no base-URL variable. | Fail closed when the variable is unset outside production. For the pilot, drop `recordId` from the email link and say that continuing needs the same browser, until a verified link exists. | With the variable unset in a Preview build, the email builder should throw. Render the email with synthetic data and confirm every URL uses the Preview host and none contains `recordId`. | Confirmed (code), Unknown (config) |
| 2 | `api/draft.js` token issue plus `resolveReportRecipientEmail` | The patch closes the request-side email override, but the address is still whatever the tester typed, and `saveDraft` issues a capability for any unused draft ID. Anyone who can reach the endpoint can mint capabilities, so a report email could be sent to an unverified third party. Prerequisites inside `generateFreeAndEmail` were not supplied. | `saveDraft`: no existing record leads to `issueDraftAccess`; recipient comes from `sessionPayload.clientEmail`. | For the pilot, add a fail-closed tester allowlist checked inside `resolveReportRecipientEmail`. Add email verification before any public use. | With the allowlist set and a mocked sender, a non-listed synthetic address should fail with no send attempt; a listed one should pass. | Inferred |
| 3 | `sendFreeReportEmail` BCC and payment links | Every report email is copied to a personal Gmail address by default, and the email embeds the $147 and $397 payment links. If Preview carries live Stripe values, testers could be charged or confused. | `process.env.INTAKE_BCC_RECIPIENT \|\| 'darren.randles@gmail.com'`; `paymentConfig()` supplies `level2Url`, `level3Url` and `consultUrl`; nothing shows whether Preview values are test-mode. | Remove the hard-coded BCC default so BCC is omitted unless set. In Preview, use Stripe test-mode links or suppress the payment buttons. | Render the email with the BCC variable unset: there should be no `bcc` field. Show redacted metadata confirming the Preview payment variables are test-mode or absent. | Confirmed (BCC), Unknown (payments) |
| 4 | Preview environment isolation | AI generation is on in Preview, and Preview writes drafts, encrypted outputs and logs. If any of Supabase, the encryption key, the Anthropic key, the Resend key, Stripe or `BTAI_DRAFT_ACCESS_SECRET` is shared with production, tester activity touches production data and spend. A token is bound to the record ID only, so a shared secret makes tokens valid across environments. | The evidence document states that credential separation is not proven; the config evidence covers only the three feature switches. | Supply redacted metadata showing, per service, whether the Preview value is distinct and branch-scoped. Set a spend limit on the Anthropic key Preview uses. | Compare short fingerprints (for example the last four characters of a hash) of each secret across environments; each pair must differ. | Unknown |
| 5 | `api/generate-dna.js` privacy gate input | The gate scans client-supplied `sourceMeta.privacyScanText`, but the text sent to the AI is the separate client-supplied `prompt`, with redactions taken from the scan text's map. A mismatched or incomplete scan text lets unscanned content reach the provider. This code is unchanged from v1.72.23 but remains in the candidate. | `participantPrivacySource = sourceMeta?.privacyScanText`; `runPrivacyGate(participantPrivacySource \|\| prompt)`; `gatedPrompt = applyPrivacyRedactions(prompt, privacyGate.redactionMap)`. | Run the gate on `prompt` as well as the scan text, and require review if either is flagged. | Send a synthetic request with clean scan text and a prompt containing a fake sensitive item the gate normally flags. Expect `409` and, with the provider call mocked, no call made. | Confirmed |
| 6 | Completion flow while report email is off | `generate-free-email` now returns `503`, yet `triggerFreeReportDelivery` still posts to it. The patch does not show the completion screen or how the response is handled, so a tester may be told a report is coming or see an error. | `if (... BTAI_ENABLE_CLIENT_REPORT_PACK ...) return res.status(503)`; `triggerFreeReportDelivery` still builds the request; no completion copy in the patch. | Confirm on Preview with a synthetic complete run. If the screen promises an email or shows an error, gate the call and copy on a server-reported flag. | Run one synthetic intake to completion: the screen should promise no email, show no error banner, and the console should be clean. | Unknown |

## Non-blocking observations

| # | File / feature area | Why it matters | Evidence | Smallest practical fix | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `index.html` save status | The status element is added only in the welcome form, so a failed save during the questions shows nowhere. A "saved, safe to refresh" message is also set whenever any earlier save returns, even if a newer save is still pending. If the first save's response is lost, the record exists but the browser holds no token, so later saves return `403`. | One `draft-save-status` element in the welcome block; `updateDraftSaveStatus('Your answers are saved...')` runs on every successful response; the token is returned only when a record is first created. | Move the element to a shared header. Show "saved" only when no payload is pending. On a `403` during save, start a fresh draft ID. | Inferred |
| 2 | `lib/draft-access.js` lifetime | The capability lasts 180 days while the draft retention review date is 30 days. It is a bearer value in browser storage with no revocation. | `DEFAULT_TTL_DAYS = 180`; `retentionMetadata('draft')` adds 30 days. | Default the lifetime to 30 days. | Confirmed |
| 3 | `scripts/pilot-safety-contract-test.mjs` | The test matches source text and order, plus a token unit test. It does not run the handlers or test expiry, so a passing result does not show that save, delete, report or notification calls return `403`. Results are as reported. | `assert.match(...)` on file contents; `requireBefore(...)`. | Add handler-level tests with a stubbed store for each endpoint, plus an expired-token case. | Confirmed |
| 4 | `docs/V1.72.25_PRIVATE_PREVIEW_SIGNOFF.md` | Manual check 5 says not to submit a completed intake that triggers an AI call unless the tester is authorized, while the stated state is that AI generation is on for invited testers and the test-page brief asks testers to review the Snapshot. Testers may not know whether to finish. | Sign-off "Manual tester checks" item 5 versus "Private Preview operating state". | State plainly which testers may complete an intake and trigger generation. | Confirmed |
| 5 | `api/send-email.js` and `sendEmailWithDNA` | When notifications are later approved, nothing calls the endpoint (the call was removed from `submitInterview`), and repeat requests for one record would send repeat emails. | `await sendEmailWithDNA()` removed; no sent marker in the handler. | Before enabling, add a caller and a per-record sent marker. | Confirmed |

## Evidence gaps

These are not treated as passing checks.

- An aggregate Resend or provider send count while the email features are off.
- A mobile screenshot from the v1.72.25 Preview.
- Proof that every Preview service credential and the draft access secret are distinct from production.
- How testers reach the Preview, for example whether Vercel deployment protection or a shared bypass link is used. This decides who can mint capabilities and trigger AI calls.
- Whether a spend limit exists on the Anthropic key Preview uses.
- How `assertRateLimit` stores its counts (in memory or durable), since `lib/security.js` was not supplied. This affects both AI spend and email abuse.
- The completion-screen code and the prerequisites inside `generateFreeAndEmail`.
- Independent confirmation of the two test runs, which are reported by the author.

## Recommendation

`Release posture: STAGING ONLY`

No blocker was found, so private testing with synthetic data can continue, but the Preview access and AI spend gaps above should be closed before more testers are invited, and findings 1 to 6 must be cleared before report emails are enabled.

Needs fixes before enabling free-report emails
