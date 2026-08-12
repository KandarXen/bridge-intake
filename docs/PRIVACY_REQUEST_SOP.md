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

