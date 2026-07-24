# Bridge To AI Intake App - v1.522 Privacy Consent Build

This build keeps the v1.50/v1.51 secure intake storage model and adds admin-only report generation from a completed Venture DNA record.

## What Changed

- Browser stores only a random session ID.
- Welcome screen now requires the interviewee email address for future report-link delivery and recovery.
- Welcome screen explains that the interview adapts: short answers may get clarifying follow-ups, while detailed answers can reduce unnecessary probing.
- Welcome screen requires Privacy Policy consent before the interview can start.
- Privacy consent version and timestamp are stored inside the encrypted intake record.
- `privacy.html` provides a standalone Privacy Policy page linked from the welcome screen and footer.
- Hermes KPI logging now captures partner/campaign tags, consent status, answer-depth buckets, short-answer rates, adaptive follow-up counts, completion summaries, and report-pack generation events.
- Supabase setup now includes the `intake_kpi_events` reporting view for aggregate AFPA/member intelligence reporting without decrypting raw interviews.
- Shared server helper code lives in `lib/` so Vercel Hobby does not count helper modules as serverless functions.
- Draft actions are consolidated into `/api/draft`.
- Adaptive interview AI actions are consolidated into `/api/interview-ai`.
- Draft answers are saved through `/api/draft`.
- Drafts are encrypted with `AES-256-GCM` before Supabase storage.
- Resume loads encrypted drafts through `/api/draft`.
- Completed Venture DNA output is encrypted and saved in Supabase.
- Hermes re-identification maps are encrypted and saved in Supabase.
- Hermes event logs are saved in Supabase instead of Google Drive.
- Adaptive AI calls use the Hermes anonymization wrapper.
- Email is notification-only by default.
- Private admin retrieval is available through `admin.html` and `/api/admin-output`.
- Admin-only three-report generation is available through `admin.html` and `/api/report-pack`.
- Report pack ZIP download includes three client-facing DOCX reports, one internal BTAI Advisor Brief DOCX, and a validation summary.
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
1-Detailed_AI_Growth_Report.docx
2-Full_AI_Implementation_Roadmap.docx
3-BTAI_Advisor_Brief_Internal.docx
```

Generate one report at a time, then download the ZIP. Each generated report is encrypted and stored in Supabase before retrieval.

The internal BTAI Advisor Brief is for Bridge To AI only. It summarizes what to clarify, what to listen for, likely opportunity angles, risk notes, and proposal direction without requiring the raw Venture DNA file to leave secure storage.

## Privacy Model

The secure path is:

```text
Client browser
  -> Vercel API
    -> Hermes privacy / validation layer
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

Hermes logs anonymized KPI events only. It does not log raw answer text or client email. Useful events include:

```text
interview_started
interview_start_blocked
privacy_consent_checked
privacy_policy_link_clicked
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
