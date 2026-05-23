-- Allow leadership page to remove/replace attendance records
create policy "attendance_delete" on attendance for delete using (true);
