# Final Privacy/Legal Review Packet

Version: 2026-08-12

Provide this packet to a Canadian privacy lawyer or qualified privacy reviewer before collecting sensitive client data.

## Include

- `privacy.html`
- `SUPABASE_SETUP.sql`
- `SECURE_DEPLOY_CHECKLIST.md`
- `docs/KEY_ROTATION_RUNBOOK.md`
- `docs/INCIDENT_RESPONSE_SOP.md`
- `docs/PRIVACY_REQUEST_SOP.md`
- `docs/VENDOR_DPA_REGISTER.md`
- endpoint inventory: `/api/draft`, `/api/interview-ai`, `/api/generate-dna`, `/api/report-pack`, `/api/send-email`, `/api/admin-output`, `/api/partner-aggregate`, `/api/admin-session`
- sample privacy proof export
- sample deletion/access request log
- Vercel WAF screenshots
- Supabase Auth/MFA screenshots
- vendor DPA evidence

## Questions For Reviewer

1. Is the privacy policy accurate for the actual data flow and vendors?
2. Are consent, cross-border processing notice, and partner aggregate disclosure adequate?
3. Are retention/deletion commitments realistic and enforceable?
4. Are the safeguards appropriate for the sensitivity of the intake?
5. What data should be prohibited from the first intake?
6. What must change before paid implementation work with deeper operational files?

