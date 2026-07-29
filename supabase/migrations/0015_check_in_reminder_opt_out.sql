-- Lets a profile opt out of the overdue check-in reminder email (see
-- lib/notifications/check-in-reminder.ts and /api/cron/check-in-reminder).
-- Default on, same convention as weekly_digest_enabled (0014).
alter table public.profiles
  add column if not exists check_in_reminder_enabled boolean not null default true;
