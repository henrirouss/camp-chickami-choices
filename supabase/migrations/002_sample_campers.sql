-- Sample campers for Group A (dev/preview only)
do $$
declare
  gid uuid;
begin
  select id into gid from groups where name = 'A';

  insert into campers (first_name, last_name, group_id) values
    ('Emma',   'M.', gid),
    ('Jake',   'L.', gid),
    ('Sofia',  'R.', gid),
    ('Marcus', 'T.', gid),
    ('Lily',   'C.', gid),
    ('Deon',   'W.', gid);
end $$;
