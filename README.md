# Bridge To AI Intake App - v1.50 Secure Storage Build

This build changes the intake app from browser/local/email-based recovery to a server-side encrypted storage model.

## What Changed

- Browser stores only a random session ID.
- Shared server helper code lives in `lib/` so Vercel Hobby does not count helper modules as serverless functions.
- Draft actions are consolidated into `/api/draft`.
- Adaptive interview AI actions are consolidated into `/api/interview-ai`.
- Draft answers are saved through `/api/draft-save`.
- Drafts are encrypted with `AES-256-GCM` before Supabase storage.
- Resume loads encrypted drafts through `/api/draft-load`.
- Completed Venture DNA output is encrypted and saved in Supabase.
- Hermes re-identification maps are encrypted and saved in Supabase.
- Hermes event logs are saved in Supabase instead of Google Drive.
- Adaptive AI calls use the Hermes anonymization wrapper.
- Email is notification-only by default.
- Private admin retrieval is available through `admin.html` and `/api/admin-output`.
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

For Vercel Hobby compatibility, `/api` should contain only 5 endpoint files. The shared helper modules must remain in `lib/`.
