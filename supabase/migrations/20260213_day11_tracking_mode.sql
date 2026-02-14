alter table public.meals
  add column if not exists tracking_mode text not null default 'estimate'
    check (tracking_mode in ('estimate', 'precise'));
