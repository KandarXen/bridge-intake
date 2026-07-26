# Bridge To AI Intake App - v1.57 Report Orchestrator

This build keeps the v1.56 trust-first, controlled industry-adaptive intake and adds the first report orchestration layer for a better client and admin experience.

## What Changed

- Privacy Policy version is now `2026-07-25-v1.56.1`.
- Header version is now `v1.57`.
- Completed intakes can automatically trigger free report generation and delivery to the interviewee's email address.
- `/api/report-pack` now supports `generate-free-email` for the finished intake flow.
- `/api/report-pack` now supports `generate-all` so the admin page can generate the full report pack in one orchestration run.
- The admin page now has a **Generate Full Report Pack** button. The individual report buttons remain as recovery tools only.
- The DOCX builder has been upgraded with stronger Word styles, better spacing, heading hierarchy, bullet handling, and markdown table rendering.
- Completion-page next-step copy now matches the free-intake model instead of implying every user automatically receives a full roadmap and workbench build.
- Completion-page BTAI follow-up preference now has an explicit **Save preference** action.
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
- Private admin retrieval is available through `admin.html` and `/api/admin-output`.
- Admin-only three-report generation is available through `admin.html` and `/api/report-pack`.
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
```

## Admin Retrieval

After a completed intake, use:

```text
/admin.html
```

Paste the notification email's Record ID and the private `BTAI_ADMIN_SECRET` to download the decrypted `.md` file.

The DNA is decrypted server-side only after the admin secret is verified.

## Admin Report Pack

The admin page can also generate the report files:

```text
0-Free_AI_Opportunity_Snapshot.docx
1-Detailed_AI_Readiness_Opportunity_Report.docx
2-Preliminary_AI_Action_Plan.docx
3-BTAI_Advisor_Brief_Internal.docx
```

Generate one report at a time, then download the ZIP. Each generated report is encrypted and stored in Supabase before retrieval.

The internal BTAI Advisor Brief is for Bridge To AI only. It summarizes what to clarify, what to listen for, likely opportunity angles, risk notes, and proposal direction without requiring the raw Venture DNA file to leave secure storage.

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
report_pack_zip_built
report_pack_zip_downloaded
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
