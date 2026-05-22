-- ============================================================
-- Camp Chickami — Leadership policies + schedule storage
-- ============================================================

-- campers: allow delete (needed for roster manager and CSV replace)
create policy "campers_delete" on campers for delete using (true);

-- groups: allow insert (needed for CSV upload creating new groups)
create policy "groups_insert" on groups for insert with check (true);

-- ── Supabase Storage: schedules bucket ──────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'schedules',
  'schedules',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "schedules_upload" on storage.objects
  for insert to anon with check (bucket_id = 'schedules');

create policy "schedules_select" on storage.objects
  for select using (bucket_id = 'schedules');

create policy "schedules_update" on storage.objects
  for update to anon using (bucket_id = 'schedules');
