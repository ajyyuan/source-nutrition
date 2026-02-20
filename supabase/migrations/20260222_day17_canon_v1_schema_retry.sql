alter table public.canonical_foods
  add column if not exists display_name text,
  add column if not exists kingdom text,
  add column if not exists domain text,
  add column if not exists food_group text,
  add column if not exists subgroup text,
  add column if not exists default_state text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists variant_template_id text,
  add column if not exists variant_values jsonb not null default '{}'::jsonb,
  add column if not exists notes text,
  add column if not exists is_canon_v1 boolean not null default false,
  add column if not exists is_usable boolean not null default true,
  add column if not exists match_status text,
  add column if not exists match_source text,
  add column if not exists match_confidence double precision;

update public.canonical_foods
set
  display_name = coalesce(nullif(display_name, ''), canonical_name),
  default_state = coalesce(nullif(default_state, ''), 'raw'),
  match_status = coalesce(nullif(match_status, ''), 'legacy')
where
  display_name is null
  or display_name = ''
  or default_state is null
  or default_state = ''
  or match_status is null
  or match_status = '';

create index if not exists canonical_foods_canon_scope_idx
  on public.canonical_foods (is_canon_v1, is_usable);

create index if not exists canonical_foods_display_name_idx
  on public.canonical_foods (display_name);

create index if not exists canonical_foods_aliases_gin_idx
  on public.canonical_foods using gin (aliases);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'canonical_foods_default_state_check'
  ) then
    alter table public.canonical_foods
      add constraint canonical_foods_default_state_check
      check (
        default_state in ('raw', 'preserved', 'fermented', 'oil', 'dairy_processed')
      );
  end if;
end
$$;

create table if not exists public.canonical_food_aliases (
  alias text primary key,
  canonical_id text not null references public.canonical_foods (canonical_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists canonical_food_aliases_canonical_id_idx
  on public.canonical_food_aliases (canonical_id);

alter table public.canonical_food_aliases enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_food_aliases'
      and policyname = 'canonical_food_aliases_read_authenticated'
  ) then
    create policy "canonical_food_aliases_read_authenticated"
      on public.canonical_food_aliases
      for select
      to authenticated
      using (true);
  end if;
end
$$;

create table if not exists public.canonical_variant_dimensions (
  key text primary key,
  label text not null,
  value_type text not null,
  allowed_values jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'canonical_variant_dimensions_value_type_check'
  ) then
    alter table public.canonical_variant_dimensions
      add constraint canonical_variant_dimensions_value_type_check
      check (value_type in ('enum', 'number'));
  end if;
end
$$;

alter table public.canonical_variant_dimensions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_variant_dimensions'
      and policyname = 'canonical_variant_dimensions_read_authenticated'
  ) then
    create policy "canonical_variant_dimensions_read_authenticated"
      on public.canonical_variant_dimensions
      for select
      to authenticated
      using (true);
  end if;
end
$$;

create table if not exists public.canonical_variant_templates (
  template_id text primary key,
  applies_to jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.canonical_variant_templates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_variant_templates'
      and policyname = 'canonical_variant_templates_read_authenticated'
  ) then
    create policy "canonical_variant_templates_read_authenticated"
      on public.canonical_variant_templates
      for select
      to authenticated
      using (true);
  end if;
end
$$;

create table if not exists public.canonical_variant_template_dimensions (
  template_id text not null references public.canonical_variant_templates (template_id) on delete cascade,
  key text not null references public.canonical_variant_dimensions (key) on delete cascade,
  default_value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  primary key (template_id, key)
);

alter table public.canonical_variant_template_dimensions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_variant_template_dimensions'
      and policyname = 'canonical_variant_template_dimensions_read_authenticated'
  ) then
    create policy "canonical_variant_template_dimensions_read_authenticated"
      on public.canonical_variant_template_dimensions
      for select
      to authenticated
      using (true);
  end if;
end
$$;
