# Day 17 Handoff (Source)

Handoff for the canonical DB reset follow-through: strict parse classification behavior, prompt cleanup, and variant expansion for eggs/dairy/ground beef.

## Session Intent (Founder)
- Keep canonical selection strict and remove heuristic drift.
- Avoid parse-time placeholder clutter (unknown rows unless truly intended).
- Expand canonical coverage for practical variants:
  - egg parts
  - dairy fat-level variants
  - explicit ground beef fat variants

## What Was Completed

### 1) Strict canon classifier parse flow
- `parse-meal` remains single-call and catalog-constrained.
- Model is instructed to classify to provided canonical IDs only.
- Parsed rows now normalize display labels to canonical names.
- Free-form prompt examples were removed to avoid hard-coded behavior bias.

### 2) Prompt cleanup (generic, non-hand-tuned)
- Removed in-prompt food-specific mapping examples.
- Prompt now uses generic classifier wording:
  - choose canonical IDs from catalog
  - omit uncertain items
  - avoid invented IDs/names

### 3) Canon variant expansion implemented
- Added `egg_part` variant dimension (`whole`, `white`, `yolk`).
- Added `egg_parts` template applied to `Chicken egg`.
- Variant expansion in build pipeline now materializes concrete rows (not metadata only).
- Generated rows now include:
  - `Chicken egg`, `Egg white`, `Egg yolk`
  - `Whole milk`, `2% milk`, `1% milk`, `Skim milk`
  - `Yogurt (plain)`, `Yogurt (plain, lowfat)`, `Yogurt (plain, nonfat)`
  - `Half and half`, `Light cream`, `Heavy cream`
  - `Ground beef (30/20/15/10/7/4% fat)`

## Key Files Updated
- `supabase/functions/parse-meal/index.ts`
- `data/canon/source-canon-v1.json`
- `scripts/build-canon-v1.js`
- `scripts/reseed-canon-v1.js`
- Regenerated artifacts in `data/canon/`:
  - `source-canon-v1.flat.json`
  - `source-canon-v1.source-audit.json`
  - `source-canon-v1.match-audit.json`
  - `source-canon-v1.reseed-preview.json`
  - `source-canon-v1.post-cutover-audit.json`

## Commits Landed
- `1dd6ea5` Reset canonical food database around the Source canon list and wire all food retrieval paths to curated canon rows with alias-aware matching.
- `fe2f580` Omit uncertain parse items and surface a lightweight warning instead of auto-inserting unknown rows.
- `a955678` Drop hard-coded mapping examples from parse prompt.
- `3d491ed` Expand canon variant generation for eggs and dairy fat levels.

## Data Operations Executed
- Ran:
  - `npm run canon:build`
  - `npm run canon:reseed:dry`
  - `npm run canon:reseed:apply`
  - `npm run canon:audit`
  - `npm run canon:audit:db`
- Latest live reseed output:
  - inserted/updated `321` canonical rows
  - inserted/updated `122` alias rows

## Current Live Audit Snapshot
- `Rows=321`
- `usable=193`
- `usable_zero_vector=0`
- Query pass rate remains `3/5` on the coarse smoke set.

## Remaining Gaps / Next Steps
1) Improve canonical nutrient matching quality for unmatched/fuzzy-heavy rows (coverage issue, not flow issue).
2) Consider adding canonical variants for additional high-frequency forms (for example, cooked egg preparations if needed).
3) Tighten parse QA set with founder meal photos and explicit acceptance criteria:
   - no irrelevant items
   - no accidental fallback clutter
   - stable canonical labels in parsed + mapped sections.
