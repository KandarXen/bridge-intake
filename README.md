# Bridge To AI Intake App - v1.50 Secure Storage Build

This build changes the intake app from browser/local/email-based recovery to a server-side encrypted storage model.

## What Changed

- Browser stores only a random session ID.
- Draft answers are saved through `/api/draft-save`.
- Drafts are encrypted with `AES-256-GCM` before Supabase storage.
- Resume loads encrypted drafts through `/api/draft-load`.
- Completed Venture DNA output is encrypted and saved in Supabase.
- Hermes re-identification maps are encrypted and saved in Supabase.
- Hermes event logs are saved in Supabase instead of Google Drive.
- Adaptive AI calls use the Hermes anonymization wrapper.
- Email is notification-only by default.
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
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
BTAI_STORE_RECORD_LABELS=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
```

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

## Deployment

Upload this folder to the GitHub repo connected to Vercel. Vercel will deploy the static `index.html` and the `/api` serverless functions.
