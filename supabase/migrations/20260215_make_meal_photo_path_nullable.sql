alter table public.meals
  alter column photo_path drop not null;

update public.meals
set photo_path = null
where photo_path like 'manual/%';
