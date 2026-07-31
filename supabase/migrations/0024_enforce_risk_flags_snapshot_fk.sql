-- Defensive re-assertion of risk_flags.snapshot_id -> financial_snapshots(id).
-- 0003_risk_flags.sql has always declared this FK inline (financial_snapshots
-- was created first, in 0002), so the migration files never had a gap here.
-- But 0021/0022 showed the hosted database has drifted from migration files
-- before (a constraint left in a stale state by an earlier experiment, never
-- reverted live even though the code/migrations were). This applies the same
-- drop-then-recreate pattern those two migrations used, so the constraint is
-- guaranteed to match this definition regardless of what state the live
-- database is actually in. A no-op if it already matches.
alter table public.risk_flags drop constraint if exists risk_flags_snapshot_id_fkey;
alter table public.risk_flags
  add constraint risk_flags_snapshot_id_fkey
    foreign key (snapshot_id) references public.financial_snapshots (id) on delete cascade;
