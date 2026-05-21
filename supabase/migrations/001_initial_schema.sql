-- ============================================================
-- Camp Chickami — Initial Schema
-- ============================================================

-- uuid-ossp not needed; gen_random_uuid() is built into PostgreSQL 13+

-- ============================================================
-- TABLES
-- ============================================================

create table groups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  counselor_name text,
  submitted      boolean not null default false,
  submitted_at   timestamptz
);

create table campers (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null,
  group_id   uuid not null references groups(id) on delete cascade,
  absent     boolean not null default false,
  choice_p1  text,
  choice_p2  text,
  choice_p3  text
);

create table activities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  abbreviation text not null,
  open_p1      boolean not null default true,
  open_p2      boolean not null default true,
  open_p3      boolean not null default true
);

create table attendance (
  id          uuid primary key default gen_random_uuid(),
  camper_id   uuid not null references campers(id) on delete cascade,
  activity_id uuid not null references activities(id),
  period      integer not null,
  status      text,
  location    text,
  logged_at   timestamptz,
  logged_by   text
);

create table settings (
  id                 uuid primary key default gen_random_uuid(),
  schedule_image_url text,
  sync_peak_start    time,
  sync_peak_end      time,
  sync_fast_interval  integer,
  sync_slow_interval  integer,
  two_col_cutoff     integer default 40,
  show_next_picks    boolean default true,
  show_sig_line      boolean default true,
  paper_size         text default 'letter',
  sheets_url         text,
  last_synced_at     timestamptz
);

create table daily_log (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id),
  counselor_name text,
  date           date not null,
  action         text not null,
  logged_at      timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on campers(group_id);
create index on attendance(camper_id);
create index on attendance(activity_id);
create index on attendance(period);
create index on daily_log(group_id);
create index on daily_log(date);

-- ============================================================
-- SEED: 16 Groups (A–P)
-- ============================================================

insert into groups (name) values
  ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H'),
  ('I'), ('J'), ('K'), ('L'), ('M'), ('N'), ('O'), ('P');

-- ============================================================
-- SEED: 14 Activities
-- ============================================================

insert into activities (name, abbreviation) values
  ('Field',         'F'),
  ('Pool',          'Pool'),
  ('Arts & Crafts', 'A/C'),
  ('Pav',           'Pav'),
  ('Gaga',          'Gaga'),
  ('Front Lawn',    'FL'),
  ('Building',      'B'),
  ('Courts',        'C'),
  ('Chowderhouse',  'CH'),
  ('Nature',        'N'),
  ('Archery',       'Arch'),
  ('Ropes',         'R'),
  ('Loch Lodge',    'LL'),
  ('New Games',     'NG');

-- ============================================================
-- SEED: Default Settings Row
-- ============================================================

insert into settings (
  sync_peak_start, sync_peak_end,
  sync_fast_interval, sync_slow_interval,
  two_col_cutoff, show_next_picks, show_sig_line, paper_size
) values (
  '08:00', '18:00',
  30, 300,
  40, true, true, 'letter'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- All tables have RLS enabled. Public read is allowed on all
-- tables (camp data is not sensitive). Write is open for anon
-- so counselor pages can submit choices and log attendance.
-- Tighten update/delete policies when Supabase Auth is added
-- by replacing "using (true)" with a JWT group-claim check.

alter table groups     enable row level security;
alter table campers    enable row level security;
alter table activities enable row level security;
alter table attendance enable row level security;
alter table settings   enable row level security;
alter table daily_log  enable row level security;

-- activities: reference data, fully public
create policy "activities_select" on activities for select using (true);

-- settings: counselor pages need sync config
create policy "settings_select" on settings for select using (true);
create policy "settings_update" on settings for update using (true);

-- groups: read for all; counselors update submission status
create policy "groups_select" on groups for select using (true);
create policy "groups_update" on groups for update using (true);

-- campers: read for all; counselors update choices/absence
create policy "campers_select" on campers for select using (true);
create policy "campers_insert" on campers for insert with check (true);
create policy "campers_update" on campers for update using (true);

-- attendance: full read/write for counselor and leadership pages
create policy "attendance_select" on attendance for select using (true);
create policy "attendance_insert" on attendance for insert with check (true);
create policy "attendance_update" on attendance for update using (true);

-- daily_log: append-only for counselors; leadership reads all
create policy "daily_log_select" on daily_log for select using (true);
create policy "daily_log_insert" on daily_log for insert with check (true);
