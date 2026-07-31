-- Same drift as profiles_field_check (see 0021_fix_profiles_field_check.sql):
-- the hosted database's manual_checkins_field_check had also been left at
-- `field = 'medicine'` only from the "Medicine-only strip-down" experiment,
-- silently blocking check-in submissions for every other manual-checkin
-- field (engineering, other). Restore the original 0006_manual_checkins.sql
-- definition covering all four supported fields.
alter table public.manual_checkins drop constraint if exists manual_checkins_field_check;
alter table public.manual_checkins
  add constraint manual_checkins_field_check check (field in ('finance', 'medicine', 'engineering', 'other'));
