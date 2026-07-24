# Bridge To AI Intake v1.522 Secure Deploy Checklist

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
3. Confirm the welcome screen links to `/privacy.html` from both the consent checkbox and footer.
4. Try to start an intake without checking the Privacy Policy consent box; confirm it blocks start.
5. Start an intake after entering name, valid email, business name, business type, and checking consent.
6. Confirm the adaptive interview explanation appears on the welcome screen.
7. Answer one or two questions.
8. Refresh the browser.
9. Confirm the resume card appears.
10. Complete a test intake.
11. Confirm the notification email arrives and includes the client email, privacy consent status, consent timestamp, and policy version.
12. Confirm Supabase has:
   - one `intake_sessions` row
   - one `venture_dna_markdown` row in `intake_outputs`
   - Hermes events in `intake_events`
13. Open `/admin.html` and retrieve the test DNA using the Record ID and `BTAI_ADMIN_SECRET`.
14. On `/admin.html`, generate the reports one at a time:
    - Free Snapshot
    - Detailed Report
    - Full Roadmap
    - BTAI Advisor Brief
15. Download the Report Pack ZIP.
16. Confirm Supabase has encrypted rows in `intake_outputs` for:
    - `report_free_snapshot_markdown`
    - `report_free_snapshot_docx`
    - `report_detailed_growth_markdown`
    - `report_detailed_growth_docx`
    - `report_full_roadmap_markdown`
    - `report_full_roadmap_docx`
    - `report_btai_advisor_brief_markdown`
    - `report_btai_advisor_brief_docx`
    - `three_report_pack_zip`

## 6. Security Notes

- Browser local storage keeps only the session ID.
- Draft answers are encrypted server-side before Supabase storage.
- Completed DNA output is encrypted before Supabase storage.
- Hermes re-identification maps are encrypted before Supabase storage.
- External AI calls use the Hermes anonymization layer.
- Privacy consent is required before interview start and stored in the encrypted record with a policy version and timestamp.
- Email is notification-only by default.
- Google Drive is no longer the primary storage path.
- Report files are generated from the encrypted completed intake record and stored encrypted before admin download.
- The report pack ZIP intentionally excludes the raw Venture DNA markdown. The raw markdown remains available only through the protected admin MD retrieval action.
