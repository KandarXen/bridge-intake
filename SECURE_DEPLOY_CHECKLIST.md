# Bridge To AI Intake v1.59.1 Secure Deploy Checklist

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `SUPABASE_SETUP.sql`.
4. Copy the project URL.
5. Copy the secret/service-role key. Never expose it in browser code.

## 2. Generate Encryption Key

Run this locally in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Use the generated value as `BTAI_ENCRYPTION_KEY`.

## 3. Vercel Environment Variables

Required:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_ANON_KEY=
BTAI_ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
BTAI_ADMIN_SECRET=
BTAI_ENABLE_EMERGENCY_ADMIN_SECRET=false
BTAI_ALLOWED_ORIGINS=https://intake.bridgetoai.ca,https://www.bridgetoai.ca
TURNSTILE_SECRET_KEY=
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
BTAI_STORE_RECORD_LABELS=false
BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=true
BTAI_LEVEL2_PRICE_LABEL=$147 introductory
BTAI_LEVEL3_PRICE_LABEL=$397 introductory
BTAI_LEVEL2_PAYMENT_URL=
BTAI_LEVEL3_PAYMENT_URL=
BTAI_CONSULTATION_URL=
```

For live purchases, `BTAI_LEVEL2_PAYMENT_URL` and `BTAI_LEVEL3_PAYMENT_URL` should be Stripe Payment Links such as `https://buy.stripe.com/...`.

`BTAI_STORE_RECORD_LABELS=false` keeps client and business names out of plaintext Supabase metadata. The names remain inside encrypted payloads.

`BTAI_ADMIN_SECRET` is only an emergency fallback when `BTAI_ENABLE_EMERGENCY_ADMIN_SECRET=true`. Normal production must use Supabase admin sign-in with MFA and keep `BTAI_ENABLE_EMERGENCY_ADMIN_SECRET=false`.

`BTAI_ALLOWED_ORIGINS` must include every production domain that is allowed to submit intake/admin requests. Do not use `*`.

`SUPABASE_ANON_KEY` is required for Supabase Auth admin sign-in. Admin API access requires a Supabase access token with `aal2` and `app_metadata.btai_admin=true` or `app_metadata.role=btai_admin`.

`TURNSTILE_SECRET_KEY` enables server-side Turnstile enforcement for final report-generation/delivery actions. Do not set this until `CONFIG.TURNSTILE_SITE_KEY` has been added to `index.html` and verified in preview.

Set `BTAI_ENABLE_EMERGENCY_ADMIN_SECRET=false` for normal production. Turn it on only during a documented emergency window.

## 3.1 Supabase Admin Auth Setup

1. Enable Supabase Auth.
2. Create the real BTAI admin user account(s).
3. Enroll TOTP MFA for each admin from `/btai-records-console`: sign in with password, click **Set Up MFA**, scan the QR code in an authenticator app, enter the generated code, then click **Verify MFA**.
4. Set each admin user's app metadata to include either `"btai_admin": true` or `"role": "btai_admin"`.
5. Insert matching rows into `admin_profiles`.
6. Verify `/btai-records-console` says **Signed in with Supabase admin MFA**.
7. In Supabase Auth URL configuration, add `https://intake.bridgetoai.ca/btai-records-console` to allowed redirect URLs so password recovery links can return to the admin console.

## 3.2 Vercel Firewall / Abuse Controls

Configure Vercel WAF rate limits before production:

- `/api/generate-dna`: 5-10 requests/minute/IP.
- `/api/report-pack`: 5-10 requests/minute/IP.
- `/api/send-email`: 5 requests/minute/IP.
- `/api/interview-ai`: 20 requests/minute/IP.
- `/api/admin-*` and `/api/partner-aggregate`: strict admin-only monitoring.

Start in log mode on preview, then enforce `429` or challenge/deny in production.

## 4. Upload Files

Upload this full folder set to GitHub:

```text
index.html
privacy.html
vercel.json
api/
lib/
docs/
btai-records-console.html
SUPABASE_SETUP.sql
SECURE_DEPLOY_CHECKLIST.md
README.md
```

The `api/` folder should contain 9 serverless endpoint files. The helper files belong in `lib/`, not `api/`, so the Vercel Hobby plan stays under the 12-function limit.

`api/` should contain only:

```text
admin-output.js
admin-session.js
draft.js
generate-dna.js
hermes-log.js
interview-ai.js
partner-aggregate.js
report-pack.js
send-email.js
```

`lib/` should contain only:

```text
crypto.js
docx.js
privacy.js
report-html.js
security.js
supabase-rest.js
validate-output.js
```

## 5. Test

1. Open the Vercel preview URL.
2. Open `/privacy.html` and confirm the Privacy Policy loads and shows version `2026-07-25-v1.56.1`.
3. Open `/btai-records-console` and confirm the page includes **Generate Full Report Pack** and **Download Privacy Proof JSON**.
4. Confirm `/?testComplete=1` on the public preview does not open completion test mode.
5. Run a local-only completion-page test if needed, then close that local server before production testing.
6. Confirm the completion page primary button says **Email my free report**, not **Save preference** after a real test intake.
7. Start a real intake and confirm:
   - first Voice & Standards prompt shows as step 1 of 44;
   - second Voice & Standards prompt shows as step 2 of 44;
   - first business question shows as step 3 of 44;
   - Back from the first business question returns to the second Voice & Standards prompt.
8. Open `/btai-records-console`, sign in with MFA, paste a real completed Record ID, then click **Send/Resend Free Report Email**.
9. Confirm:
   - the interviewee receives the free report email with DOCX attached;
   - `INTAKE_BCC_RECIPIENT` receives a copy with the report attached;
   - the original intake notification email includes the Record ID for admin retrieval;
   - Supabase has `report_free_snapshot_markdown`, `report_free_snapshot_docx`, and `free_report_emailed` event records.
   - Supabase has `report_btai_advisor_brief_markdown` and `report_btai_advisor_brief_docx` if `BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=true`.
   - The free-report email includes Level 2, Level 3, and implementation/workbench breadcrumbs.
10. To test the actual final-page button, complete a real controlled test intake and click **Email my free report** from that completion page.
3. Open `/?partner=AFPA&campaign=AFPA_December_AI_Course_2026`.
4. Confirm the welcome screen is co-branded for AFPA and says AFPA receives anonymized aggregate insights only.
5. On desktop, confirm the welcome screen uses a wider two-column layout: explanation/trust content on the left, start form on the right.
6. Confirm the welcome screen says exact financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential operating data are not needed for the first intake.
7. Confirm the welcome screen links to `/privacy.html` from both the consent checkbox and footer.
6. Try to start an intake without checking the Privacy Policy consent box; confirm it blocks start.
7. Start an intake after entering name, valid email, business name, business type, and checking consent.
8. Confirm the adaptive interview explanation appears on the welcome screen.
9. Answer one or two questions.
10. Refresh the browser.
11. Confirm the resume card appears.
12. Complete a test intake.
13. Confirm the completion screen shows the BTAI follow-up interest question.
14. Select Yes, Maybe, or No and confirm a `btai_followup_interest_selected` event appears in secure processing logs.
15. Confirm the notification email arrives and includes the client email, privacy consent status, consent timestamp, and policy version.
16. Confirm Supabase has:
   - one `intake_sessions` row
   - one `venture_dna_markdown` row in `intake_outputs`
   - Secure processing events in `intake_events`
   - KPI rows visible through the `intake_kpi_events` view
17. Open `/btai-records-console` and retrieve the test DNA using a Supabase admin account with MFA plus the Record ID.
18. On `/btai-records-console`, click **Download Privacy Proof JSON** and confirm:
    - `encryptedRecordsConfirmed` is `true`
    - `anonymizedAiAnalysisConfirmed` is `true`
    - `privacyConsentConfirmed` is `true`
    - `crossBorderNoticeConfirmed` is `true`
    - `retentionPolicyRecorded` is `true`
    - `reportPrivacyScanCompleted` is `true`
    - `rawDataSharedWithPartner` is `false`
    - `rawDnaIncludedInReportZip` is `false`
    - the export contains proof events but no raw interview answers

19. On `/btai-records-console`, generate the reports one at a time if needed:
    - Free Snapshot
    - Detailed Opportunity Report
    - Preliminary Action Plan
    - BTAI Advisor Brief
20. Download the Report Pack ZIP.
21. Confirm Supabase has encrypted rows in `intake_outputs` for:
    - `report_free_snapshot_markdown`
    - `report_free_snapshot_docx`
    - `report_detailed_growth_markdown`
    - `report_detailed_growth_docx`
    - `report_full_roadmap_markdown` (legacy output type for Preliminary Action Plan)
    - `report_full_roadmap_docx` (legacy output type for Preliminary Action Plan)
    - `report_btai_advisor_brief_markdown`
    - `report_btai_advisor_brief_docx`
    - `three_report_pack_zip`
22. Confirm ZIP filenames use:
    - `Client_Name_Level1_report.docx`
    - `Client_Name_Level2_Report.docx`
    - `Client_Name_Level3_Report.docx`
    - `Client_Name_Internal_brief.docx`
23. Open the free report DOCX and confirm:
    - the Level 2 purchase link appears in the report body
    - the Level 3 purchase link appears in the report body
    - the BTAI Secure Intelligence Layer privacy statement appears in the report body
    - no raw Venture DNA markdown is included

## Automated Privacy-Proof Smoke Test

Before accepting sensitive client data, run:

```bash
node scripts/privacy-proof-smoke-test.mjs
```

Expected result:

```text
PASS encryptedRecordsConfirmed
PASS anonymizedAiAnalysisConfirmed
PASS privacyConsentConfirmed
PASS crossBorderNoticeConfirmed
PASS retentionPolicyRecorded
PASS adminAccessLogged
PASS reportPrivacyScanCompleted
PASS reportPrivacyScanBlockingIssueFound is false
```

This test creates a synthetic `privacy-smoke-...` record only. It does not send real client data to the AI provider.

## 6. Security Notes

- Browser local storage keeps only the session ID.
- Draft answers are encrypted server-side before Supabase storage.
- Completed DNA output is encrypted before Supabase storage.
- Re-identification maps are encrypted before Supabase storage where required.
- External AI calls use the BTAI secure processing layer.
- Privacy consent is required before interview start and stored in the encrypted record with a policy version and timestamp.
- KPI logs intentionally exclude raw answer text and client email.
- Partner/campaign tracking is URL-driven. Use `?partner=AFPA&campaign=AFPA_December_AI_Course_2026` for AFPA member links.
- Email is notification-only by default.
- Google Drive is no longer the primary storage path.
- Report files are generated from the encrypted completed intake record and stored encrypted before admin download.
- The report pack ZIP intentionally excludes the raw Venture DNA markdown. The raw markdown remains available only through the protected admin MD retrieval action.
- Privacy proof logs are sanitized event records. They prove encryption/anonymization/report handling without logging raw answers, client email, recipes, suppliers, payroll, invoices, formulas, or confidential operating data.
- v1.59 proof logs include consent proof, cross-border notice proof, retention proof, report privacy scan proof, and admin access audit proof.
- v1.59.1 adds the evidence-first/no-sycophancy standard to the intake welcome screen and report prompts.
