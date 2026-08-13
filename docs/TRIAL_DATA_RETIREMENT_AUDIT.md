# Trial Data Retirement Audit Note

Version: 2026-08-13-v1

## Purpose

This note documents the retirement of Bridge To AI trial intake records created before the production encryption reset.

## Summary

During prototype-to-production hardening, the active encryption key changed and the previous key was not retained. Encrypted trial intake payloads and any encrypted database-only outputs created with the previous key are no longer decryptable by Bridge To AI.

The affected data is being treated as retired trial data. Records are to be quarantined with `retired_lost_key = true`, excluded from resume/retrieval workflows, and optionally payload-erased after any external report copies have been checked.

## Audit Evidence To Preserve

- Retirement batch ID
- SQL execution timestamp
- Approver
- Cutoff date used to identify trial records
- Count of affected `intake_sessions`
- Count of affected `intake_outputs`
- Output inventory by Record ID and output type
- Statement that old key is unavailable and cannot decrypt AES-256-GCM payloads
- Confirmation that partner aggregate reporting did not include raw interview records

## Client Report Handling

Generated reports stored only in `intake_outputs.encrypted_payload` may also be unrecoverable if encrypted under the lost key. Reports that were emailed, downloaded, or saved outside Supabase remain usable copies and should be handled as client-facing report records.

Before erasing payloads, export the output inventory from `TRIAL_DATA_RETIREMENT.sql` and check local/email copies for any client-facing reports.

## Recovery Statement

AES-256-GCM encrypted payloads cannot be decrypted or re-encrypted without the original encryption key. If the old key is unavailable and no plaintext/exported copy exists, Bridge To AI cannot recover the original intake data or database-only generated reports.

## Production Boundary

Records before the selected cutoff are trial records. Records after the cutoff are governed by the current production encryption key, admin MFA process, consent flow, Turnstile abuse control, and privacy proof logging.
