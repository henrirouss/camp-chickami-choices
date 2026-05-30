-- Add per-period capacity caps to activities
-- NULL means unlimited (no cap). Integer means max signups for that period.
alter table activities
  add column if not exists capacity_p1 integer,
  add column if not exists capacity_p2 integer,
  add column if not exists capacity_p3 integer;

-- Allow leadership to update activities (toggle open/closed, set capacity)
do $$ begin
  create policy "activities_update" on activities for update using (true);
exception when duplicate_object then null;
end $$;
