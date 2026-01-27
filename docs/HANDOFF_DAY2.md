# Day 2 Handoff (Source)

This file captures non-repo state and operational context for continuing Day 3 in a new chat.

## Project Status (Day 2 complete)
- Photo upload + meal creation flow still working.
- AI parse stub working end-to-end (parse-meal edge function).
- Canonical mapping stub working end-to-end (map-foods edge function).
- Editable food list UI implemented (name + grams editing, add/remove items).

## Supabase Setup (current)
### Project
- Project ref: `cpbwrjeoxkkxyduovjhh`
- Project URL and anon key are in `.env` (same as Day 1).

### Edge Functions
1) `parse-meal`
   - Deployed and working as a stub.
   - Returns `{ items: [{ name, estimated_grams, confidence }] }` with a placeholder item.
   - JWT verification disabled at function level.

2) `map-foods`
   - Deployed and working as a stub.
   - Returns `{ items: [{ name, canonical_id, canonical_name, confidence }] }`.
   - JWT verification disabled at function level.

### Supabase config
- `supabase/config.toml` has:
  - `[functions.parse-meal] verify_jwt = false`
  - `[functions.map-foods] verify_jwt = false`

## Local Environment
- Supabase CLI installed via Homebrew (v2.72.7).
- Logged in and linked to project ref `cpbwrjeoxkkxyduovjhh`.
- `.vscode/` created by Supabase CLI when generating Deno settings.

## How to Run
1) `npm install`
2) `npx expo run:ios`

## How to Deploy Edge Functions
From repo root:
- `supabase functions deploy parse-meal`
- `supabase functions deploy map-foods`

## Day 2 UI Behavior (expected)
- After capture: shows parsed foods list (stub).
- Shows canonical mapping list (stub).
- Editable foods list: name + grams fields, add/remove items.

## Known TODOs / Next Steps (Day 3)
- Replace parse-meal stub with real AI parsing and validation.
- Replace map-foods stub with real canonical mapping.
- Persist final items to DB and begin nutrient computation pipeline (Day 3 scope).
