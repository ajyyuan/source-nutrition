alter table public.meals
  add column if not exists final_items jsonb,
  add column if not exists nutrient_totals jsonb,
  add column if not exists nutrient_db_version text;

create policy "meals_update_own"
  on public.meals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
