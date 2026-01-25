alter table public.meals
  add column if not exists insights jsonb;
