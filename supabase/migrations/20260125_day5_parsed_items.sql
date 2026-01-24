alter table public.meals
  add column if not exists parsed_items jsonb,
  add column if not exists model_version text;
