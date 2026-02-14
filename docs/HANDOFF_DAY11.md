# [Day 11 Handoff (Source)]

Short handoff for tracking-mode contract and global preference wiring.

## Recent Progress (Feb 2026)
- Added meal-level `tracking_mode` schema contract in Supabase (`estimate` default, constrained to `estimate|precise`).
- Implemented app-level tracking mode preference (`estimate` / `precise`) shared across screens.
- Wired capture/manual/save/recalculate flows to persist the current app preference into `meals.tracking_mode`.

## Notable Changes
- `supabase/migrations/20260213_day11_tracking_mode.sql`
  - Adds `public.meals.tracking_mode text not null default 'estimate'`
  - Adds check constraint: `tracking_mode in ('estimate', 'precise')`
- `src/lib/trackingMode.tsx`
  - New tracking mode context + provider
  - Persists preference in local app storage
- `App.tsx`
  - Wraps authenticated app with `TrackingModeProvider`
- `src/screens/CaptureScreen.tsx`
  - Uses global app preference
  - Writes `tracking_mode` on meal create
  - Updates `tracking_mode` on edit/recalculate save path
  - Adds simple app tracking mode selector in capture/review surfaces
- `src/screens/HomeScreen.tsx`
  - Adds app tracking mode selector
  - Updates copy to reflect estimate vs precise display posture

## Product Decision Captured
- UX mode selection is app-level in v1 (not per-meal toggle in capture flow).
- `meals.tracking_mode` remains persisted per meal for provenance and mixed-day support.
- Changing app preference does not batch-convert past meals; mode updates apply when a meal is saved.

## Suggested Next Steps
1) Implement estimate-mode nutrient bands (gray/yellow/green) in Capture/Home/History primary surfaces.
2) Implement precise-mode units and conversion (`g`, `oz`, `lb`, `ml`, `fl oz`, `cup`, `tbsp`, `tsp`).
3) Finalize mixed-day rendering rules in primary summaries.

## Future Considerations
- Move app-level tracking preference from local storage to server profile if cross-device sync is desired.
- Add user-facing explanation when precise view includes meals created from estimated quantities.
