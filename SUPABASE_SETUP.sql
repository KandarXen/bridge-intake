-- Bridge To AI Intake v1.56 trust-first industry-adaptive secure storage schema
-- Safe to rerun: uses IF NOT EXISTS where possible.

create extension if not exists pgcrypto;

create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  client_draft_id text not null unique,
  status text not null default 'created',
  business_category text,
  client_name_label text,
  business_name_label text,
  current_step text,
  current_question integer,
  encrypted_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intake_outputs (
  id uuid primary key default gen_random_uuid(),
  client_draft_id text not null,
  output_type text not null,
  encrypted_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.intake_events (
  id uuid primary key default gen_random_uuid(),
  client_draft_id text,
  event_type text not null,
  status text,
  stage text,
  question_index integer,
  domain text,
  answer_word_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_trace (
  id uuid primary key default gen_random_uuid(),
  client_draft_id text not null,
  report_section text,
  claim_text text,
  evidence_type text,
  source_question_id text,
  source_excerpt text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_intake_sessions_client_draft_id
  on public.intake_sessions (client_draft_id);

create index if not exists idx_intake_outputs_client_type_created
  on public.intake_outputs (client_draft_id, output_type, created_at desc);

create index if not exists idx_intake_events_client_created
  on public.intake_events (client_draft_id, created_at desc);

create index if not exists idx_intake_events_type_created
  on public.intake_events (event_type, created_at desc);

create index if not exists idx_claim_trace_client_created
  on public.claim_trace (client_draft_id, created_at desc);

alter table public.intake_sessions enable row level security;
alter table public.intake_outputs enable row level security;
alter table public.intake_events enable row level security;
alter table public.claim_trace enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.intake_sessions to service_role;
grant select, insert, update, delete on public.intake_outputs to service_role;
grant select, insert, update, delete on public.intake_events to service_role;
grant select, insert, update, delete on public.claim_trace to service_role;

drop view if exists public.intake_kpi_events;

create view public.intake_kpi_events as
select
  id,
  created_at,
  client_draft_id,
  event_type,
  status,
  stage,
  question_index,
  domain,
  answer_word_count,
  metadata #>> '{details,partner}' as partner,
  metadata #>> '{details,campaign}' as campaign,
  metadata #>> '{businessCategory}' as business_category,
  metadata #>> '{businessNiche}' as business_niche,
  metadata #>> '{shareComfort}' as share_comfort,
  metadata #>> '{companySize}' as company_size,
  metadata #>> '{ownerWorkStatus}' as owner_work_status,
  metadata #>> '{details,answerQualityBucket}' as answer_quality_bucket,
  (metadata #>> '{details,isShortAnswer}')::boolean as is_short_answer,
  (metadata #>> '{details,hasNumber}')::boolean as has_number,
  (metadata #>> '{details,hasExampleLanguage}')::boolean as has_example_language,
  (metadata #>> '{details,privacyConsent}')::boolean as privacy_consent,
  metadata #>> '{details,privacyPolicyVersion}' as privacy_policy_version,
  metadata #>> '{details,btaiFollowupInterest}' as btai_followup_interest,
  nullif(metadata #>> '{details,durationSeconds}', '')::integer as duration_seconds,
  nullif(metadata #>> '{details,totalWordCount}', '')::integer as total_word_count,
  nullif(metadata #>> '{details,answeredPromptCount}', '')::integer as answered_prompt_count,
  nullif(metadata #>> '{details,totalPromptCount}', '')::integer as total_prompt_count,
  nullif(metadata #>> '{details,completedPromptCount}', '')::integer as completed_prompt_count,
  nullif(metadata #>> '{details,completionFraction}', '')::numeric as completion_fraction,
  nullif(metadata #>> '{details,completionPercent}', '')::numeric as completion_percent,
  nullif(metadata #>> '{details,currentPromptNumber}', '')::integer as current_prompt_number,
  nullif(metadata #>> '{details,lastCompletedQuestionIndex}', '')::integer as last_completed_question_index,
  nullif(metadata #>> '{details,lastCompletedQuestionNumber}', '')::integer as last_completed_question_number,
  nullif(metadata #>> '{details,averageWordsPerAnswer}', '')::integer as average_words_per_answer,
  nullif(metadata #>> '{details,shortAnswerCount}', '')::integer as short_answer_count,
  nullif(metadata #>> '{details,shortAnswerRate}', '')::numeric as short_answer_rate,
  nullif(metadata #>> '{details,generatedProbeCount}', '')::integer as generated_probe_count,
  nullif(metadata #>> '{details,answeredProbeCount}', '')::integer as answered_probe_count,
  metadata #>> '{details,rejectedReason}' as adaptive_probe_rejected_reason,
  metadata #>> '{details,sensitivityLevel}' as adaptive_probe_sensitivity_level,
  metadata #>> '{details,proposedQuestionType}' as adaptive_probe_proposed_type,
  nullif(metadata #>> '{details,sourceQuestionIndex}', '')::integer as adaptive_probe_source_question_index,
  metadata #>> '{details,sourceQuestionType}' as adaptive_probe_source_question_type,
  nullif(metadata #>> '{details,priorityWeight}', '')::integer as adaptive_probe_priority_weight,
  metadata #>> '{details,weakAnswerReason}' as adaptive_probe_weak_answer_reason,
  (metadata #>> '{details,weakAnswerRedirect}')::boolean as adaptive_probe_weak_answer_redirect,
  metadata #>> '{details,abandonmentReason}' as abandonment_reason,
  (metadata #>> '{details,abandoned}')::boolean as abandoned,
  metadata
from public.intake_events;

grant select on public.intake_kpi_events to service_role;
