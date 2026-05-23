-- Add Google OAuth fields to settings
alter table settings
  add column if not exists google_access_token  text,
  add column if not exists google_refresh_token text,
  add column if not exists google_token_expiry  timestamptz,
  add column if not exists google_email         text;
