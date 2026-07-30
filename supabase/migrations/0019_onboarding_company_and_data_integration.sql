-- Onboarding now asks for a company name and whether Beacon can integrate
-- with the user's database/systems (see app/onboarding/actions.ts). Existing
-- rows get an empty company_name and a null (unanswered) integration
-- preference rather than backfilling a guess.
alter table public.profiles
  add column if not exists company_name text not null default '';

alter table public.profiles
  add column if not exists wants_data_integration boolean;
