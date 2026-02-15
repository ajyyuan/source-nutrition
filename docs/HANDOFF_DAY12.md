# [Day 12 Handoff (Source)]

Short handoff for dual tracking mode completion, persistence fixes, and capture reliability updates.

## Recent Progress (Feb 2026)
- Completed dual tracking mode implementation for v1 UX:
  - `estimate` mode shows signal-band summaries (gray/yellow/green).
  - `precise` mode supports explicit quantity + unit input with conversion.
- Added precise unit metadata persistence so values like `5 oz` survive app restart/reload.
- Fixed capture navigation state bug where returning from meal edit could leave Capture stuck in edit mode.
- Improved large-image handling for parsing by lowering client capture quality and increasing parse size cap.

## Commits (local)
- `f6db4bf` Add estimate-mode nutrient signal bands.
- `94f5eb6` Add precise-mode unit conversion input.
- `364f82f` Fix precise unit persistence across app restarts.
- `c6b66db` Fix capture screen edit mode reset.
- `ed2ab53` Loosen photo size constraints for meal parsing.

## Notable Changes
- `src/lib/nutrientBands.ts`
  - Shared estimate-mode banding helper for nutrient display.
- `src/lib/unitConversion.ts`
  - Unit conversion helpers for precise mode (`toGrams`, `fromGrams`).
- `src/screens/CaptureScreen.tsx`
  - Precise quantity+unit editing UI.
  - Mode toggle behavior with unit memory/restore.
  - Explicit persistence of `quantity`, `unit`, and `last_precise_unit` on mapped save.
  - Edit-flow reset logic clears stale `mealId` param when leaving edit.
- `src/screens/HomeScreen.tsx`
  - Estimate-mode nutrient signal rendering on primary summaries.
- `src/screens/HistoryScreen.tsx`
  - Estimate-mode nutrient signal rendering for daily totals.
- `supabase/functions/map-foods/index.ts`
  - Handles/persists precise quantity metadata in `final_items`.
- `supabase/functions/parse-meal/index.ts`
  - Parse image size cap increased to 12MB.

## Deployment Notes
- User confirmed `parse-meal` function was deployed after large-image fix.
- If not already deployed, deploy `map-foods` to keep server-side metadata handling aligned:
  - `supabase functions deploy map-foods`

## Current Product State
- Meal-level `tracking_mode` contract is in place and migrated.
- App-level mode preference controls primary UX posture (`estimate` vs `precise`).
- Estimate and precise display/input flows are both implemented and test-validated in main workflows.

## Founder-Requested Near-Term Direction
1) Reduce Home/History redundancy:
   - avoid showing daily totals in both places in the same way
   - candidate: make History day totals collapsible/expandable (collapsed by default)
2) Home layout simplification:
   - replace stacked "Today" + "7-day average" cards with a single shared view and a toggle/slider (`Today` / `Week Avg`)
3) Tracking mode control design:
   - move app tracking mode lower on Home
   - in Capture, reduce mode switch prominence (smaller/sleeker treatment)
4) Nutrient visualization:
   - move from text-heavy rows to horizontal fill bars
   - use color to encode low/medium/strong
   - in precise mode, show exact `%DV` value alongside bars
5) Data quality track:
   - improve canonical food DB size/coverage, mapping quality, and CV parsing reliability
6) Longer-term product direction:
   - explore streaks/reward mechanics (potential farm/local promo tie-ins)

## Recommended Execution Order (for next agent)
1) **UI information architecture pass (high priority)**
   - Home: single summary card with `Today` / `Week Avg` segmented toggle
   - History: daily totals collapsed by default for selected day
2) **Tracking mode control polish**
   - keep primary mode switch on Home
   - make Capture mode indicator compact/non-dominant
3) **Shared nutrient bar component**
   - implement reusable bar row for Capture/Home/History
   - precise mode: show `%DV` numeric label
   - estimate mode: emphasize band/signal semantics
4) **Quality sprint**
   - expand food mapping coverage and CV robustness
   - add QA checklist across mode toggles, app restarts, and edit flows
5) **Future concept exploration**
   - define rewards/streaks concept doc before implementation
