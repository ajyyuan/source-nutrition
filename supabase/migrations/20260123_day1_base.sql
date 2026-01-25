create extension if not exists "pgcrypto";

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null,
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "meals_insert_own"
  on public.meals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "meals_select_own"
  on public.meals
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy "Authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'meal-photos');
