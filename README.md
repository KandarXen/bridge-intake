# Bridge To AI - Client Intake App

Current release: v1.46

This repo powers the Bridge To AI client intake interview. Clients complete a private discovery session, the app generates a confidential Venture DNA markdown file, and the result is sent to the Bridge team by email.

## Repo Structure

Keep the repo lean. The deployed app should contain:

```text
index.html
vercel.json
api/
```

The `api/` folder should contain:

```text
generate-dna.js
hermes-log.js
mastery-followup.js
oauth-authorize.js
oauth-callback.js
probe.js
research-business.js
save-to-drive.js
scenario.js
send-email.js
```

Do not keep old release zip files, duplicate index files, backup folders, or archived versions in the repo root.

## Deployment

This app is deployed with Vercel.

After uploading changes to GitHub, Vercel should automatically create a new deployment. To confirm the correct build is live, open the deployed app and check the top-right header version.

Expected version marker:

```text
v1.46
```

If the deployed page does not show `v1.46`, Vercel is still serving an older build or deploying from a different source.

## Required Environment Variables

The Vercel project needs these environment variables configured:

```text
ANTHROPIC_API_KEY
RESEND_API_KEY
GOOGLE_DRIVE_FOLDER_ID
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_OAUTH_REFRESH_TOKEN
OAUTH_SETUP_SECRET
```

Optional/currently used for Google service account experiments:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

## Current Notes

- Email delivery is handled through Resend.
- Google Drive and Hermes logging depend on Google OAuth credentials.
- If Vercel logs show `invalid_grant`, Google OAuth needs to be refreshed or replaced with service account auth.
- Hermes logging should never block the client interview.
- The visible question screen should never be blank. v1.46 includes static first-question fallback text and defensive render handling.

## Quick Smoke Test

After deployment:

1. Open the Vercel deployment or production domain.
2. Confirm the header shows `v1.46`.
3. Start a test intake with dummy business details.
4. Confirm the first question text appears.
5. Answer the first prompt and click Continue.
6. Watch Vercel logs for API errors.

If the button still shows a fancy arrow like `Continue →`, the old build is still live. v1.46 uses `Continue ->`.
