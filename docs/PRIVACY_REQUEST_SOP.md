# BTAI Access, Correction, and Deletion Request SOP

Version: 2026-08-12

## Intake

Record every request in `privacy_requests` with:

- request type: access, correction, deletion, consent withdrawal, complaint;
- requester email;
- `client_draft_id` if known;
- received date;
- due date;
- handler;
- status.

## Identity Check

Before releasing or deleting personal information, verify control of the requester's email address and match it against the encrypted intake session.

## Access Request

1. Locate the session by email or Record ID.
2. Export the privacy proof summary.
3. Export the client-facing report and any raw intake record only when approved by the privacy owner.
4. Log the admin access purpose.

## Deletion Request

1. Confirm identity.
2. Locate `intake_sessions`, `intake_outputs`, `intake_events`, and `claim_trace` rows.
3. Decide whether event metadata must be retained for security/legal audit.
4. Erase or irreversibly anonymize payloads.
5. Mark request complete and record completion evidence.

## Correction Request

1. Confirm the requested correction.
2. Amend the active report or source profile.
3. Preserve correction audit history.



## Lost-Key Trial Data Retirement

Use this process only for prototype/trial records where the previous encryption key is unavailable and the affected payloads cannot be decrypted or re-encrypted.

1. Notify affected trial participants using `docs/TRIAL_PARTICIPANT_EMAIL.md`.
2. Run `TRIAL_DATA_RETIREMENT.sql` first with `erase_payloads = false`.
3. Save the audit result sets: retirement batch, affected sessions, and output inventory.
4. Check whether client-facing reports exist outside Supabase, such as emailed/downloaded HTML, DOCX, PDF, or Markdown files.
5. If approved by the privacy owner, rerun the SQL with `erase_payloads = true` to overwrite encrypted database payloads with non-sensitive tombstones.
6. Preserve `docs/TRIAL_DATA_RETIREMENT_AUDIT.md`, the SQL result exports, and the participant notification record.
7. Do not represent database-only encrypted reports as recoverable unless they are successfully decrypted under an available key or exist as exported/email copies.
