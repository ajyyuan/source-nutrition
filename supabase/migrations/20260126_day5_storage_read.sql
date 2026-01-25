create policy "Authenticated read meal photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'meal-photos'
  and auth.uid() = owner
);
