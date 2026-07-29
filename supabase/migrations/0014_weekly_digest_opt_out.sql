-- Lets a profile opt out of the weekly digest email (see
-- lib/notifications/weekly-digest.ts and /api/cron/weekly-digest). Default
-- on, same as notification_preferences' per-signal email_enabled default.
alter table public.profiles
  add column if not exists weekly_digest_enabled boolean not null default true;
