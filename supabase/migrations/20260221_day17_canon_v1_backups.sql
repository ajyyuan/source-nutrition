create table if not exists public.canonical_foods_backups (
  backup_run_id text not null,
  canonical_id text not null,
  canonical_row jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (backup_run_id, canonical_id)
);

create index if not exists canonical_foods_backups_run_idx
  on public.canonical_foods_backups (backup_run_id, backed_up_at desc);

create table if not exists public.canonical_food_aliases_backups (
  backup_run_id text not null,
  alias text not null,
  alias_row jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (backup_run_id, alias)
);

create index if not exists canonical_food_aliases_backups_run_idx
  on public.canonical_food_aliases_backups (backup_run_id, backed_up_at desc);
