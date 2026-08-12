# BTAI Privacy/Security Incident Response SOP

Version: 2026-08-12

## First 30 Minutes

1. Pause affected intake links or Vercel deployment if active harm is possible.
2. Preserve logs: Vercel deployment logs, Supabase logs, Resend event logs, and admin access events.
3. Rotate exposed keys if a secret may be compromised.
4. Identify affected records by `client_draft_id`, email, date range, and endpoint.

## Assessment

Classify:

- Data involved: draft, completed intake, Venture DNA, re-identification map, report, admin index, aggregate metadata.
- Exposure type: unauthorized access, accidental email, API abuse, vendor issue, lost device, wrong partner report.
- Risk: low, moderate, high, real risk of significant harm.

## Notification

If there is a real risk of significant harm, notify affected individuals and the Office of the Privacy Commissioner of Canada as required by Canadian privacy law. Use legal/privacy counsel for final notification wording.

## Closure

Document:

- timeline;
- affected records;
- containment;
- notification decision;
- remediation;
- keys rotated;
- code/config changes;
- owner sign-off.

