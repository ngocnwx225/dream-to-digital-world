-- Configurable line shown under the system name (sidebar, login). NULL keeps the default text.
alter table public.settings add column if not exists brand_subtitle text;
