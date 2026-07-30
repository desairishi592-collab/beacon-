-- The hosted database's profiles_field_check had drifted to `field =
-- 'medicine'` only — a leftover from an earlier "Medicine-only strip-down"
-- experiment (see git history) that was reverted in application code but
-- never reverted on the live schema. Restore the original 0001_profiles.sql
-- definition covering all four supported fields.
alter table public.profiles drop constraint if exists profiles_field_check;
alter table public.profiles
  add constraint profiles_field_check check (field in ('finance', 'medicine', 'engineering', 'other'));
