create policy "meals_delete_own"
  on public.meals
  for delete
  to authenticated
  using (auth.uid() = user_id);
