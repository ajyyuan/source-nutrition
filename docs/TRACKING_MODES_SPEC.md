# Tracking Modes Spec (v1)

## Goal

Support two ways to track micronutrients without forcing fake precision:
- **Estimate mode** for speed and directionality
- **Precise mode** for exact totals

## Scope

Applies to meal creation, nutrient rendering, and daily/weekly summaries.

## Mode Model

- Persisted field: `meals.tracking_mode`
- Values: `estimate` | `precise`
- Granularity: **per meal (persisted provenance)**
- Default: `estimate`

In v1, mode selection UX is app-level:
- App preference: `estimate` | `precise` (global UI preference)
- New meals are saved with the current app preference as `meals.tracking_mode`
- Editing and re-saving a meal applies the current app preference on save

## User Experience Rules

### Estimate mode
- Primary nutrient display uses banded quality signals (gray/yellow/green).
- Avoid exact-looking totals in primary summary surfaces.
- Confidence language should be explicit and non-medical.

### Precise mode
- User provides explicit quantity and unit.
- Primary nutrient display can show exact numeric totals and %DV.

## Switching Rules (v1)

- User chooses mode as a global app preference.
- Preference can be switched at any time.
- Existing meals are not batch converted when preference changes.
- A meal's `tracking_mode` updates when that meal is saved/recalculated.
- Mixed-mode days are allowed.

## Data and Computation Rules

- Nutrient computation remains deterministic and server-side.
- Existing `final_items` / `nutrient_totals` model remains intact.
- `tracking_mode` controls presentation and interaction contract, not nutrient engine determinism.

## Mixed-Mode Day Rendering (v1)

- If any included meal is `estimate`, day-level summaries should be treated as estimate-style in primary UI.
- Precise numeric detail can still be available in drill-down or detail views.

## Units (Precise Mode)

Initial unit set:
- mass: `g`, `oz`, `lb`
- volume: `ml`, `fl oz`, `cup`, `tbsp`, `tsp`

Implementation requirement:
- normalize internally to canonical base units before nutrient math.

## Non-Goals (v1)

- Per-item mixed modes inside one meal
- Server-synced account-level global preference
- Clinical recommendation logic

## Rollout Plan

1. Add `tracking_mode` migration and app type support.
2. Wire global mode preference into app + capture/save flow.
3. Ship estimate-mode UI rendering in Capture/Home/History.
4. Add precise-mode quantity unit system and conversion.
