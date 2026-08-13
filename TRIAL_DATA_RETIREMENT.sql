-- Bridge To AI trial data retirement / lost-key quarantine
-- Review the CONFIG section before running in Supabase SQL editor.
-- Recommended order:
-- 1. Run with erase_payloads = false. Save the result sets as audit evidence.
-- 2. Check emailed/downloaded client reports outside Supabase.
-- 3. If approved, set erase_payloads = true and rerun to overwrite encrypted DB payloads with tombstones.

create extension if not exists pgcrypto;

create table if not exists public.privacy_retirement_audits (
  id uuid primary key default gen_random_uuid(),
  retirement_batch_id uuid not null,
  retirement_type text not null,
  cutoff_at timestamptz,
  approved_by text,
  reason text not null,
  old_key_status text not null,
  affected_session_count integer not null default 0,
  affected_output_count integer not null default 0,
  erased_payloads boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.intake_sessions add column if not exists retired_lost_key boolean not null default false;
alter table public.intake_sessions add column if not exists retired_at timestamptz;
alter table public.intake_sessions add column if not exists retired_reason text;
alter table public.intake_sessions add column if not exists retired_by text;
alter table public.intake_sessions add column if not exists retired_batch_id uuid;
alter table public.intake_sessions add column if not exists retirement_evidence jsonb not null default '{}'::jsonb;

alter table public.intake_outputs add column if not exists retired_lost_key boolean not null default false;
alter table public.intake_outputs add column if not exists retired_at timestamptz;
alter table public.intake_outputs add column if not exists retired_reason text;
alter table public.intake_outputs add column if not exists retired_by text;
alter table public.intake_outputs add column if not exists retired_batch_id uuid;
alter table public.intake_outputs add column if not exists retirement_evidence jsonb not null default '{}'::jsonb;

create index if not exists idx_intake_sessions_retired_lost_key on public.intake_sessions (retired_lost_key, created_at desc);
create index if not exists idx_intake_outputs_retired_lost_key on public.intake_outputs (retired_lost_key, created_at desc);

-- CONFIG: edit these values before running.
do $$
declare
  retirement_batch uuid := gen_random_uuid();
  cutoff timestamptz := '2026-08-13 00:00:00+00';
  approver text := 'Darren - Bridge To AI';
  retirement_reason text := 'Prototype/trial records retired after production encryption key reset; previous key unavailable.';
  erase_payloads boolean := false;
  session_count integer := 0;
  output_count integer := 0;
begin
  drop table if exists btai_trial_retirement_scope;

  create temporary table btai_trial_retirement_scope as
  select client_draft_id
  from public.intake_sessions
  where created_at < cutoff
    and client_draft_id not like 'privacy_smoke_%'
    and (
      coalesce(retired_lost_key, false) = false
      or erase_payloads = true
    );

  update public.intake_sessions s
  set retired_lost_key = true,
      retired_at = now(),
      retired_reason = retirement_reason,
      retired_by = approver,
      retired_batch_id = retirement_batch,
      status = 'retired_lost_key',
      current_step = 'retired_lost_key',
      retirement_evidence = jsonb_build_object(
        'retirementBatchId', retirement_batch,
        'cutoffAt', cutoff,
        'oldKeyStatus', 'unavailable',
        'recoveryConclusion', 'encrypted payload is not decryptable or re-encryptable without the previous key',
        'erasedPayloadInThisRun', erase_payloads
      ),
      updated_at = now(),
      encrypted_payload = case when erase_payloads then jsonb_build_object(
        'retired_lost_key', true,
        'retired_at', now(),
        'retirement_batch_id', retirement_batch,
        'original_payload_erased', true,
        'reason', retirement_reason,
        'recovery_conclusion', 'Original encrypted payload overwritten after lost-key retirement approval.'
      ) else encrypted_payload end
  where s.client_draft_id in (select client_draft_id from btai_trial_retirement_scope);

  get diagnostics session_count = row_count;

  update public.intake_outputs o
  set retired_lost_key = true,
      retired_at = now(),
      retired_reason = retirement_reason,
      retired_by = approver,
      retired_batch_id = retirement_batch,
      retirement_evidence = jsonb_build_object(
        'retirementBatchId', retirement_batch,
        'cutoffAt', cutoff,
        'oldKeyStatus', 'unavailable',
        'reportHandling', 'database-only encrypted outputs may be unrecoverable if encrypted with lost key; check emailed/downloaded copies',
        'erasedPayloadInThisRun', erase_payloads
      ),
      encrypted_payload = case when erase_payloads then jsonb_build_object(
        'retired_lost_key', true,
        'retired_at', now(),
        'retirement_batch_id', retirement_batch,
        'original_payload_erased', true,
        'reason', retirement_reason,
        'recovery_conclusion', 'Original encrypted output overwritten after lost-key retirement approval.'
      ) else encrypted_payload end
  where o.client_draft_id in (select client_draft_id from btai_trial_retirement_scope)
    and (
      coalesce(o.retired_lost_key, false) = false
      or erase_payloads = true
    );

  get diagnostics output_count = row_count;

  insert into public.privacy_retirement_audits (
    retirement_batch_id,
    retirement_type,
    cutoff_at,
    approved_by,
    reason,
    old_key_status,
    affected_session_count,
    affected_output_count,
    erased_payloads,
    metadata
  ) values (
    retirement_batch,
    'lost_encryption_key_trial_data_retirement',
    cutoff,
    approver,
    retirement_reason,
    'unavailable',
    session_count,
    output_count,
    erase_payloads,
    jsonb_build_object(
      'aesAlg', 'AES-256-GCM',
      'proofStatement', 'Without the previous AES-256-GCM key, affected encrypted payloads cannot be decrypted or re-encrypted by Bridge To AI.',
      'partnerRawAccess', false,
      'rawDataSharedWithPartner', false,
      'recommendedExternalReportCheck', true
    )
  );

  insert into public.intake_events (
    client_draft_id,
    event_type,
    status,
    stage,
    domain,
    metadata
  )
  select
    client_draft_id,
    'trial_data_retired_lost_key',
    'success',
    'privacy_retirement_audit',
    'lost_key_retirement',
    jsonb_build_object(
      'privacyProof', true,
      'retirementBatchId', retirement_batch,
      'retiredLostKey', true,
      'oldKeyStatus', 'unavailable',
      'erasedPayloadInThisRun', erase_payloads,
      'recoveryConclusion', 'Encrypted trial data cannot be recovered or re-encrypted without the previous key.',
      'rawDataSharedWithPartner', false
    )
  from btai_trial_retirement_scope;

  raise notice 'Retirement batch %, sessions %, outputs %, erase_payloads %', retirement_batch, session_count, output_count, erase_payloads;
end $$;

-- Save these result sets as audit evidence.
select *
from public.privacy_retirement_audits
where retirement_type = 'lost_encryption_key_trial_data_retirement'
order by created_at desc
limit 5;

select
  s.retired_batch_id,
  s.client_draft_id,
  s.status,
  s.retired_lost_key,
  s.retired_at,
  s.retired_reason,
  s.created_at,
  s.updated_at,
  s.business_category,
  s.client_name_label,
  s.business_name_label
from public.intake_sessions s
where s.retired_lost_key = true
order by s.retired_at desc, s.created_at desc;

select
  o.retired_batch_id,
  o.client_draft_id,
  o.output_type,
  count(*) as output_rows,
  min(o.created_at) as first_output_at,
  max(o.created_at) as latest_output_at,
  bool_or(o.encrypted_payload ? 'alg') as appears_encrypted,
  bool_or(o.encrypted_payload ? 'original_payload_erased') as payload_erased
from public.intake_outputs o
where o.retired_lost_key = true
group by o.retired_batch_id, o.client_draft_id, o.output_type
order by latest_output_at desc, o.client_draft_id, o.output_type;
