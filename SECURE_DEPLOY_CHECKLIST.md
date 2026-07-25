# Bridge To AI Intake v1.56 Secure Deploy Checklist

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
BTAI_ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
BTAI_ADMIN_SECRET=
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
BTAI_STORE_RECORD_LABELS=false
```

`BTAI_STORE_RECORD_LABELS=false` keeps client and business names out of plaintext Supabase metadata. The names remain inside encrypted payloads.

`BTAI_ADMIN_SECRET` protects the private admin retrieval page at `/admin.html`.

## 4. Upload Files

Upload this full folder set to GitHub:

```text
index.html
privacy.html
vercel.json
api/
lib/
admin.html
SUPABASE_SETUP.sql
SECURE_DEPLOY_CHECKLIST.md
README.md
```

The `api/` folder should contain 7 serverless endpoint files. The helper files belong in `lib/`, not `api/`, so the Vercel Hobby plan stays under the 12-function limit.

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

`lib/` should contain only:

```text
crypto.js
docx.js
privacy.js
supabase-rest.js
validate-output.js
```

## 5. Test

1. Open the Vercel preview URL.
2. Open `/privacy.html` and confirm the Privacy Policy loads.
3. Open `/?partner=AFPA&campaign=AFPA_December_AI_Course_2026`.
4. Confirm the welcome screen is co-branded for AFPA and says AFPA receives anonymized aggregate insights only.
5. Confirm the welcome screen says exact financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential operating data are not needed for the first intake.
5. Confirm the welcome screen links to `/privacy.html` from both the consent checkbox and footer.
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
17. Open `/admin.html` and retrieve the test DNA using the Record ID and `BTAI_ADMIN_SECRET`.
18. On `/admin.html`, generate the reports one at a time:
    - Free Snapshot
    - Detailed Opportunity Report
    - Preliminary Action Plan
    - BTAI Advisor Brief
19. Download the Report Pack ZIP.
20. Confirm Supabase has encrypted rows in `intake_outputs` for:
    - `report_free_snapshot_markdown`
    - `report_free_snapshot_docx`
    - `report_detailed_growth_markdown`
    - `report_detailed_growth_docx`
    - `report_full_roadmap_markdown` (legacy output type for Preliminary Action Plan)
    - `report_full_roadmap_docx` (legacy output type for Preliminary Action Plan)
    - `report_btai_advisor_brief_markdown`
    - `report_btai_advisor_brief_docx`
    - `three_report_pack_zip`

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
