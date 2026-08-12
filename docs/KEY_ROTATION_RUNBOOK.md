# BTAI Key Rotation Runbook

Version: 2026-08-12

## Rotation Schedule

- `BTAI_ENABLE_EMERGENCY_ADMIN_SECRET`: keep `false` in production except during a documented emergency window.
- `BTAI_ADMIN_SECRET`: rotate immediately after any demo, contractor exposure, suspected exposure, or emergency use. Monthly until removed.
- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: rotate quarterly and immediately after suspected exposure.
- `SUPABASE_ANON_KEY`: rotate when Supabase Auth client exposure changes or on suspected abuse.
- `BTAI_ENCRYPTION_KEY`: rotate only in a planned maintenance window with a re-encryption migration.
- `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`: rotate quarterly and after suspected exposure.

## Emergency Secret Rotation

1. Set `BTAI_ENABLE_EMERGENCY_ADMIN_SECRET=false` in Vercel.
2. Generate a new random secret of at least 32 characters.
3. Update `BTAI_ADMIN_SECRET` in Vercel.
4. Redeploy.
5. Confirm admin APIs reject the old secret.
6. Record date, reason, operator, and verification result in the admin incident log.

## Encryption Key Rotation

Do not replace `BTAI_ENCRYPTION_KEY` casually. Existing encrypted records will become unreadable unless they are re-encrypted.

1. Freeze intake submissions.
2. Export encrypted record inventory.
3. Deploy a temporary migration script that can decrypt with the old key and re-encrypt with the new key.
4. Verify a sample of completed sessions, outputs, mappings, and privacy proof records.
5. Replace production key.
6. Redeploy.
7. Verify admin retrieval, report generation, and privacy proof export.
8. Record completion evidence.

