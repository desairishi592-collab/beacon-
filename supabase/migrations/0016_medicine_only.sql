-- Beacon is now Medicine-only: Finance (QuickBooks sync + the risk-flag
-- pipeline built on top of it) is removed, and Engineering/Other are no
-- longer offered as check-in fields. Drops every finance-derived table and
-- narrows the remaining field columns to 'medicine'.
--
-- This assumes a dev/demo dataset with no rows outside 'medicine' — if your
-- database has profiles or manual_checkins in another field, migrate or
-- delete those rows before applying the check constraints below.
drop table if exists public.alert_states;
drop table if exists public.risk_flags;
drop table if exists public.financial_snapshots;
drop table if exists public.quickbooks_connections;
drop table if exists public.quickbooks_sync_runs;
drop table if exists public.notification_preferences;

alter table public.profiles drop constraint if exists profiles_field_check;
alter table public.profiles
  add constraint profiles_field_check check (field in ('medicine'));

alter table public.manual_checkins drop constraint if exists manual_checkins_field_check;
alter table public.manual_checkins
  add constraint manual_checkins_field_check check (field in ('medicine'));
