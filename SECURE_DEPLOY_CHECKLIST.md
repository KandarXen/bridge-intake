# Bridge To AI Intake v1.50 Secure Deploy Checklist

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
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
BTAI_STORE_RECORD_LABELS=false
```

`BTAI_STORE_RECORD_LABELS=false` keeps client and business names out of plaintext Supabase metadata. The names remain inside encrypted payloads.

## 4. Upload Files

Upload this full folder set to GitHub:

```text
index.html
vercel.json
api/
SUPABASE_SETUP.sql
SECURE_DEPLOY_CHECKLIST.md
README.md
```

## 5. Test

1. Open the Vercel preview URL.
2. Start an intake.
3. Answer one or two questions.
4. Refresh the browser.
5. Confirm the resume card appears.
6. Complete a test intake.
7. Confirm the notification email arrives.
8. Confirm Supabase has:
   - one `intake_sessions` row
   - one `venture_dna_markdown` row in `intake_outputs`
   - Hermes events in `intake_events`

## 6. Security Notes

- Browser local storage keeps only the session ID.
- Draft answers are encrypted server-side before Supabase storage.
- Completed DNA output is encrypted before Supabase storage.
- Hermes re-identification maps are encrypted before Supabase storage.
- External AI calls use the Hermes anonymization layer.
- Email is notification-only by default.
- Google Drive is no longer the primary storage path.
