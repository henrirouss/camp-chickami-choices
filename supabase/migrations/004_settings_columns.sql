-- Add auto_sync and sort_order to settings
alter table settings add column if not exists auto_sync  boolean not null default false;
alter table settings add column if not exists sort_order text    not null default 'last_name';
