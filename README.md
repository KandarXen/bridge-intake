# Bridge To AI Intake App - v1.62.3 Records Console Route Hotfix

This build keeps the trust-first, controlled industry-adaptive intake, live-intended report funnel, paid-report breadcrumbs, server-side privacy-proof logging, admin privacy proof export, deterministic privacy certificates, HTML-first client reports, and privacy-safe partner aggregate intelligence reports. v1.62.3 adds explicit Vercel routing for the private records console.

## What Changed

- Privacy Policy version is now `2026-07-25-v1.56.1`.
- Header version is now `v1.62.3`.
- `vercel.json` now explicitly rewrites `/btai-records-console` to `/btai-records-console.html`.
- The private records console file is now `btai-records-console.html`.
- With Vercel `cleanUrls`, use `/btai-records-console` instead of `/admin` or `/admin.html`.
- The obvious `admin.html` file is no longer included in the deploy package.
- This is reduced visibility, not the security boundary. The real protection remains `BTAI_ADMIN_SECRET` plus server-side authorization on the admin APIs.
- Partner aggregate reports now exclude completion-page test records and obvious test Record IDs by default.
- Partner aggregate reports now disclose how many test/demo records were excluded.
- Admin now includes a **Partner Aggregate Intelligence** section.
- New `/api/partner-aggregate` endpoint creates AFPA-style aggregate reports from `intake_kpi_events` only.
- Partner aggregate reports can be downloaded as polished HTML or editable Markdown.
- Partner aggregate reports do not decrypt raw interviews, include member names, include emails, expose raw answers, or include Venture DNA files.
- The first aggregate report includes participation funnel, member segment mix, intake quality/readiness signals, likely education themes, privacy boundaries, and recommended next conversation points.
- Report generation now stores a polished HTML version for each report tier in encrypted Supabase output.
- The free report email now attaches the HTML report instead of the rougher DOCX version.
- Admin report ZIPs now include `HTML_Reports/` as the primary readable report set and `DOCX_Backup/` as editable backup files.
- Existing report records with markdown/DOCX can be converted to HTML without re-running the AI generation step.
- Admin report status now shows whether each tier has HTML and DOCX outputs.
- The intake welcome page now explains that Bridge To AI reports are evidence-first, not AI sales pitches.
- The desktop welcome page now uses a wider two-column layout so the trust message, instructions, and start form are not stacked into one long narrow page.
- The direct BTAI welcome page now includes a subtle white-label positioning note for associations, training groups, and business communities; partner links hide this note from members.
- Admin report retrieval now surfaces the actual server message instead of hiding useful causes behind a generic "Server error".
- Admin report generation now shows a live elapsed timer while long report jobs run.
- Admin report status now shows server-recorded generation duration when available.
- Admin now provides two privacy proof downloads: **Brief Privacy Certificate** and **Detailed Privacy Attestation**.
- Privacy proof generation is deterministic from server logs; it does not send raw proof logs through an AI model.
- Cross-border proof now fails if the underlying notice/provider/contact proof fields are missing.
- Report privacy scans now separate blocking findings from non-blocking policy language, so delivery is only marked blocked when it should actually stop.
- Report ZIPs now include `BTAI_Report_Pack_Summary.md` in addition to the raw validation JSON.
- Report prompts now include a permanent Evidence-First / No-Sycophancy Standard.
- Reports are instructed to say when to build now, clean up first, or avoid automation for now.
- Free, Level 2, and Level 3 client reports now include the configured purchase/booking links inside the report content, not only in the email body.
- Every report now includes the standard BTAI Secure Intelligence Layer privacy statement.
- Reports are scanned before DOCX creation for obvious sensitive-data patterns, and the scan result is logged to the privacy proof trail.
- Server-side proof now records consent, Privacy Policy version, partner aggregate disclosure, cross-border processing notice, privacy contact availability, retention policy version, scheduled review date, and deletion request availability.
- Admin download of the raw Venture DNA markdown is logged as an admin access audit event.
- Privacy Proof JSON now includes a top-level conclusion and identifies missing improvement items instead of silently passing incomplete proof.
- The two Voice & Standards prompts are now counted as interview steps 1 and 2, so the first business question appears as step 3 of 44 instead of question 1 of 42.
- Back navigation from the first business question now returns to the second Voice & Standards prompt.
- Pure completion-page test mode now disables the report-send button and labels it as test-only.
- Server-side privacy-proof events are logged for consent, anonymized AI analysis, encrypted mapping storage, encrypted output storage, report generation, free-report email delivery, ZIP creation, and admin ZIP download.
- Admin page now includes **Download Privacy Proof JSON** so BTAI can produce an AFPA-safe proof package for a Record ID without exposing raw answers.
- Free-report delivery now logs timing data so Hermes can monitor generation speed, delivery speed, retries/failures, and report bottlenecks.
- The free report is generated automatically; Level 2 and Level 3 reports are positioned as on-demand paid upgrades.
- The internal BTAI Advisor Brief is generated after the free report unless `BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=false`.
- Free-report email now includes paid-report breadcrumbs, optional payment/booking links, and a plain-English workbench description.
- Report DOCX names now use the client-level convention: `Client_Name_Level1_report.docx`, `Client_Name_Level2_Report.docx`, `Client_Name_Level3_Report.docx`, and `Client_Name_Internal_brief.docx`.
- Admin page now includes **Send/Resend Free Report Email** so real report delivery can be tested from an existing Record ID without retaking the interview.
- Completion page now includes a visible deeper-support offer for the Detailed AI Opportunity Report, Preliminary AI Action Plan, and implementation support.
- The free-report email now includes the same optional deeper-support offer.
- Completed intakes can automatically trigger free report generation and delivery to the interviewee's email address.
- Completion page now uses **Email my free report** as the primary client-facing action instead of **Save preference**.
- BTAI follow-up preference is saved silently as part of the report-delivery request.
- Report delivery status now tells the interviewee when the report is being prepared, sent, already sent, or could not be confirmed.
- `/api/report-pack` now supports `generate-free-email` for the finished intake flow.
- `/api/report-pack` now supports `generate-all` so the admin page can generate the full report pack in one orchestration run.
- The admin page now has a **Generate Full Report Pack** button. The individual report buttons remain as recovery tools only.
- The DOCX builder has been upgraded with stronger Word styles, better spacing, heading hierarchy, bullet handling, and markdown table rendering.
- Completion-page next-step copy now matches the free-intake model instead of implying every user automatically receives a full roadmap and workbench build.
- Completion-page BTAI follow-up preference now supports the report-delivery CTA instead of a separate preference-saving action.
- Completion-page test mode is available with `?testComplete=1` so the final screen can be reviewed without taking a full interview. This does not submit an interview or send a report email.
- Privacy Policy now distinguishes reversible pseudonymization/tokenization from anonymized aggregate partner reporting.
- Privacy Policy now includes named privacy accountability, cross-border processing, concrete retention/deletion targets, OPC complaint escalation, AI provider data-use language, breach response, access/correction/deletion process, minimum aggregate-reporting threshold, age restriction, cookies/analytics language, and the first-intake vs paid-implementation boundary.
- Browser stores only a random session ID.
- Welcome screen now requires the interviewee email address for future report-link delivery and recovery.
- Welcome screen now explains that exact financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential operating data are not needed for the first intake.
- Business category is now selected from a controlled list so questions can adapt examples without creating a free-roaming AI interview.
- Optional niche and detail-sharing comfort fields are captured for safer tailoring and later aggregate reporting.
- Welcome screen explains that the interview adapts: short answers may get clarifying follow-ups, while detailed answers can reduce unnecessary probing.
- Welcome screen requires Privacy Policy consent before the interview can start.
- Privacy consent version and timestamp are stored inside the encrypted intake record.
- `privacy.html` provides a standalone Privacy Policy page linked from the welcome screen and footer.
- The secure processing/KPI layer now captures partner/campaign tags, consent status, answer-depth buckets, short-answer rates, adaptive follow-up counts, completion summaries, business niche, share-comfort level, guardrail rejections, and report-pack generation events.
- Supabase setup now includes the `intake_kpi_events` reporting view for aggregate AFPA/member intelligence reporting without decrypting raw interviews.
- URL-based partner co-branding is supported. `partner=AFPA` changes the welcome page, completion copy, and consent language for the AFPA member program.
- Partner consent explains that AFPA receives anonymized aggregate insights only, not raw member interviews or individual answers.
- BTAI follow-up interest is asked on the completion screen, after the member finishes the interview.
- BTAI follow-up selections are logged as privacy-safe KPI/lead events without exposing raw answers or client email.
- Shared server helper code lives in `lib/` so Vercel Hobby does not count helper modules as serverless functions.
- Draft actions are consolidated into `/api/draft`.
- Adaptive interview AI actions are consolidated into `/api/interview-ai`.
- Draft answers are saved through `/api/draft`.
- Drafts are encrypted with `AES-256-GCM` before Supabase storage.
- Resume loads encrypted drafts through `/api/draft`.
- Completed Venture DNA output is encrypted and saved in Supabase.
- Re-identification maps are encrypted and saved in Supabase where required.
- Secure processing events are saved in Supabase instead of Google Drive.
- Adaptive AI probes are constrained by approved question types, forbidden sensitive-topic checks, repetition checks, and a maximum probe count.
- Email is notification-only by default.
- Private admin retrieval is available through `btai-records-console.html` and `/api/admin-output`.
- Admin-only three-report generation is available through `btai-records-console.html` and `/api/report-pack`.
- Report pack ZIP download includes three client-facing DOCX reports, one internal BTAI Advisor Brief DOCX, and a validation summary. The higher-tier reports are positioned as opportunity/action planning from first-intake data, not as validated ROI or final implementation scope.
- The raw Venture DNA markdown stays secure and is not included in the report pack ZIP.
- Plaintext Google Drive saving is no longer part of the normal completion path.

## Required Setup

Run `SUPABASE_SETUP.sql` in Supabase, then set the Vercel environment variables listed in `SECURE_DEPLOY_CHECKLIST.md`.

Required Vercel env vars:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
BTAI_ENCRYPTION_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
BTAI_ADMIN_SECRET
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
BTAI_STORE_RECORD_LABELS=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=true
BTAI_LEVEL2_PRICE_LABEL=$147 introductory
BTAI_LEVEL3_PRICE_LABEL=$397 introductory
BTAI_LEVEL2_PAYMENT_URL=
BTAI_LEVEL3_PAYMENT_URL=
BTAI_CONSULTATION_URL=
```

Payment links should be Stripe Payment Links or another live purchase URL:

```text
BTAI_LEVEL2_PAYMENT_URL=https://buy.stripe.com/...
BTAI_LEVEL3_PAYMENT_URL=https://buy.stripe.com/...
```

## Admin Retrieval

## Completion Page Test Mode

To test the final page without taking the full interview, open:

```text
/?testComplete=1
```

AFPA/co-branded final page:

```text
/?partner=AFPA&campaign=demo&testComplete=1
```

Optional test labels:

```text
/?testComplete=1&name=Morgan%20Ellis&business=Prairie%20Hearth%20Bakery&email=demo@bridgetoai.test
```

This mode is for UX review only. It does not create a Supabase Venture DNA record and does not email the free report.

To test real report delivery from the completion page without retaking the interview, use an existing completed Record ID:

```text
/?testComplete=1&allowRealDelivery=1&recordId=PASTE_REAL_RECORD_ID&email=CLIENT_EMAIL_ON_THAT_RECORD
```

The email must match the email stored on that secure intake session. This mode does not submit a new interview; it only lets you test the final-page **Email my free report** action against an existing encrypted Supabase record.

After a completed intake, use:

```text
/btai-records-console
```

Paste the notification email's Record ID and the private `BTAI_ADMIN_SECRET` to download the decrypted `.md` file.

The DNA is decrypted server-side only after the admin secret is verified.

## Admin Report Pack

The admin page can also generate the report files:

```text
Client_Name_Level1_report.docx
Client_Name_Level2_Report.docx
Client_Name_Level3_Report.docx
Client_Name_Internal_brief.docx
```

Generate one report at a time, then download the ZIP. Each generated report is encrypted and stored in Supabase before retrieval.

The internal BTAI Advisor Brief is for Bridge To AI only. It summarizes what to clarify, what to listen for, likely opportunity angles, risk notes, and proposal direction without requiring the raw Venture DNA file to leave secure storage.

## Privacy Proof Export

Use `/btai-records-console`, paste the Record ID and `BTAI_ADMIN_SECRET`, then click **Download Privacy Proof JSON**.

The export is designed for AFPA/client trust review. It includes sanitized event proof such as:

```text
privacy_proof_consent_recorded
privacy_proof_cross_border_notice
privacy_proof_retention_policy_recorded
privacy_proof_anonymization_completed
privacy_proof_mapping_storage
privacy_proof_ai_analysis_requested
privacy_proof_secure_output_storage
report_privacy_scan_completed
report_generation_started
report_generated
free_report_emailed
admin_raw_dna_retrieved
admin_privacy_proof_downloaded
report_pack_zip_built
report_pack_zip_downloaded
```

The proof export does not include raw interview answers, raw Venture DNA content, client email, private recipes, supplier/customer details, payroll, invoices, formulas, or confidential operating data.

## Privacy Model

The secure path is:

```text
Client browser
  -> Vercel API
    -> BTAI secure processing layer
      -> encrypted Supabase storage
      -> anonymized model calls
      -> validated outputs
```

The browser does not keep the full intake in local storage.

## AFPA KPI Logging

AFPA campaign links can include:

```text
/?partner=AFPA&campaign=AFPA_December_AI_Course_2026
```

The secure processing layer logs anonymized KPI events only. It does not log raw answer text or client email. Useful events include:

```text
interview_started
interview_start_blocked
privacy_consent_checked
privacy_policy_link_clicked
btai_followup_interest_selected
answer_saved
business_domain_completed
adaptive_probe_requested
domain_probe_generated
domain_probe_skipped
interview_completed_answers
interview_submission_complete
submission_failed
report_generated
free_report_emailed
internal_brief_after_free_complete
report_pack_zip_built
report_pack_zip_downloaded
privacy_proof_anonymization_completed
privacy_proof_ai_analysis_requested
privacy_proof_secure_output_storage
```

Use the Supabase `intake_kpi_events` view for aggregate dashboards and AFPA reports.

## Deployment

Upload this folder to the GitHub repo connected to Vercel. Vercel will deploy the static `index.html`, `privacy.html`, and the `/api` serverless functions.

For Vercel Hobby compatibility, `/api` should contain only 7 endpoint files. The shared helper modules must remain in `lib/`.

`api/` should contain only:

```text
admin-output.js
draft.js
generate-dna.js
hermes-log.js
interview-ai.js
report-pack.js
send-email.js
```

`lib/` should contain:

```text
crypto.js
docx.js
privacy.js
supabase-rest.js
validate-output.js
```
