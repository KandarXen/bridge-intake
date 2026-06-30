# Bridge To AI Intake - OAuth Drive Deploy Notes

This version saves completed DNA markdown files into Darren's own Google Drive using OAuth. It does not use a Google service account.

## Required Vercel Environment Variables

Set these before the first OAuth setup run:

| Name | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `RESEND_API_KEY` | Resend API key |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth web client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://intake.bridgetoai.ca/api/oauth-callback` |
| `GOOGLE_DRIVE_FOLDER_ID` | The destination Drive folder ID |
| `OAUTH_SETUP_SECRET` | A long random setup password |

After the one-time setup, add:

| Name | Value |
| --- | --- |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Refresh token copied from `/api/oauth-callback` |

## Google Cloud Setup

1. Enable the Google Drive API in Google Cloud Console.
2. Create an OAuth client credential for a web application.
3. Add this authorized redirect URI:

```txt
https://intake.bridgetoai.ca/api/oauth-callback
```

4. Save the client ID and client secret into Vercel.

## One-Time Authorization

After deploying with the first set of environment variables, visit:

```txt
https://intake.bridgetoai.ca/api/oauth-authorize?setup=YOUR_OAUTH_SETUP_SECRET
```

Approve access with Darren's Google account. The callback page will display a refresh token once. Copy it into Vercel as:

```txt
GOOGLE_OAUTH_REFRESH_TOKEN
```

Redeploy after adding the refresh token.

## After Setup

Do not share the setup URL. To disable setup access, remove or change `OAUTH_SETUP_SECRET` after the refresh token has been saved.

## Test

Run one dummy intake and confirm:

1. The DNA email arrives.
2. The `.md` attachment is present.
3. The `.md` file appears in the Google Drive folder.
4. The email includes the Drive link.
