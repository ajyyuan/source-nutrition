-- Saved meals: user-defined templates (name + items) for quick logging.
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.saved_meals enable row level security;

create policy "saved_meals_insert_own"
  on public.saved_meals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_meals_select_own"
  on public.saved_meals
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_meals_update_own"
  on public.saved_meals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_meals_delete_own"
  on public.saved_meals
  for delete
  to authenticated
  using (auth.uid() = user_id);
