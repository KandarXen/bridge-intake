# BTAI Vendor and DPA Register

Version: 2026-08-12

| Vendor | Use | Data categories | Cross-border risk | Required action |
|---|---|---|---|---|
| Vercel | Hosting, serverless functions, firewall | Request metadata, app logs, environment secrets | Possible US/global subprocessors | Review security docs and DPA; configure WAF/rate limits |
| Supabase | Postgres, Auth, encrypted record storage | Intake records, admin profiles, privacy logs | Region/subprocessor dependent | Select region, review DPA, enable MFA, confirm backups/retention |
| Anthropic/Claude | AI analysis/report generation | Pseudonymized/tokenized prompts where practical | Possible US processing | Review data-use terms/DPA; confirm no-training setting/enterprise terms as applicable |
| Resend | Email delivery | Recipient email, report attachment for free report | Possible US/global subprocessors | Review DPA; minimize attachments; configure verified domain |
| Cloudflare Turnstile | Bot/human verification | IP/device verification signals | Possible global processing | Review Turnstile terms/DPA; add to privacy policy if needed |

Owner sign-off required before sensitive client data:

- DPAs reviewed or accepted.
- Data residency and subprocessors reviewed.
- Privacy policy matches actual vendors.
- AI provider data-use terms confirmed.

