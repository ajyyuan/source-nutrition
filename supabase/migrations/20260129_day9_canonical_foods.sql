create table if not exists public.canonical_foods (
  canonical_id text primary key,
  canonical_name text not null,
  per_100g jsonb not null,
  source text not null,
  fdc_id text,
  created_at timestamptz default now()
);

alter table public.canonical_foods enable row level security;

create policy "canonical_foods_read_authenticated"
  on public.canonical_foods
  for select
  to authenticated
  using (true);
