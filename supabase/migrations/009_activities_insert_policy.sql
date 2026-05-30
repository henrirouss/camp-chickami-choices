-- Allow the app (anon role) to insert session activities when a session is activated.
-- Without this, activateSession silently fails to write rows to the activities
-- table, so counselors see no activities for the session.
do $$ begin
  create policy "activities_insert" on activities for insert with check (true);
exception when duplicate_object then null;
end $$;
