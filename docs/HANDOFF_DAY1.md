# Day 1 Handoff (Source)

This file captures the non-repo state and operational context needed to continue work in a new chat.

## Project Status (Day 1 complete)
- App shell + navigation working.
- Supabase auth plumbing with magic-link sign-in.
- Camera capture flow implemented.
- Photo upload to Supabase Storage working.
- Meal record creation after upload working.
- Manual smoke check passed.

## Supabase Setup (current)
### Auth
- Email magic-link enabled.
- Redirect URL configured: `source://auth`
- App scheme: `source` (set in `app.json`).
- Deep-link handling implemented (code exchange + session set).
- Note: custom scheme requires a dev build or standalone app (not Expo Go).

### Storage
- Bucket name: `meal-photos`
- Upload policy (insert, authenticated users only):
  - SQL used:
    ```sql
    create policy "Authenticated upload"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'meal-photos');
    ```

### Database
- Table: `public.meals`
  - Columns:
    - `id uuid primary key default gen_random_uuid()`
    - `user_id uuid not null references auth.users(id) on delete cascade`
    - `photo_path text not null`
    - `created_at timestamptz not null default now()`
  - RLS enabled.
  - Policies:
    ```sql
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
    ```

## Local Environment
- `.env` file in project root contains:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- These are required for auth and storage to work.

## Known Behaviors
- Uploads use timestamped filenames, so repeated uploads of the same photo are allowed.
- Magic links open `source://auth` and complete sign-in inside the dev build.

## How to Run
1) `npm install`
2) `npx expo start -c`
3) Use a dev build (custom scheme not supported in Expo Go).

## Tests Performed
- Sign in via magic link.
- Capture photo, preview, retake.
- Upload to Storage and insert into `meals`.
- Sign out and repeat flow.

## TODO / Next Steps (Day 2)
- AI parsing + editable food list.
- Canonical mapping.
- Keep Day 2 scope only.

