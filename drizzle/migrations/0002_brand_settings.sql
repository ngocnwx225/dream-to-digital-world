-- Branding configurable from Cai dat: logo (small square PNG as a data URL) and primary colour (#rrggbb).
-- NULL keeps the bundled logo / theme colour.
alter table public.settings
  add column if not exists logo_url text,
  add column if not exists brand_color text check (brand_color is null or brand_color ~* '^#[0-9a-f]{6}$');

alter table public.settings alter column store_name set default 'Chơi Xe-Xe Chơi';
update public.settings set store_name = 'Chơi Xe-Xe Chơi' where store_name = 'StoreFlow';
