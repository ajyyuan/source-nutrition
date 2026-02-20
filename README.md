# Source

Source is an iOS app that turns meal photos into micronutrient insight.

Instead of asking "How many calories did I eat?", Source asks:

> "What did this food actually give my body?"

## Current Product Direction

Source now uses a single nutrient-tracking experience:

- **Banded nutrient signals:** gray/yellow/green for uncertainty-aware interpretation
- **Visible %DV context:** numeric percent labels shown alongside signal bars
- **Unit-based inputs:** quantity + unit entry remains supported for meal editing quality

This keeps the app honest when CV confidence is imperfect while still exposing concrete numeric context.

## Current Status

- iOS app in active development (Expo + Supabase)
- Native Apple sign-in working
- Google OAuth available in UI
- Magic-link auth removed from app flow

## Canonical Food DB (v1)

- Canon source of truth lives in `data/canon/source-canon-v1.json`
- Canon tooling scripts:
  - `npm run canon:build`
  - `npm run canon:reseed:dry`
  - `npm run canon:reseed:apply`
  - `npm run canon:audit`
- Runtime food retrieval is scoped to curated canon rows (`is_canon_v1` + `is_usable`)
- See `docs/FOOD_DB_PLAN.md` for full migration and reseed workflow

## Core Principles

- **Micronutrients > macros**
- **Estimates > fake precision**
- **Correction over perfection**
- **Clarity over gamification**
- **Real food over abstraction**

## Documentation

- Project scope and constraints: `docs/PROJECT.md`
- Architecture overview: `docs/ARCHITECTURE.md`
- Current roadmap: `docs/ROADMAP.md`
- Nutrient presentation spec: `docs/TRACKING_MODES_SPEC.md`
- Docs index: `docs/README.md`

## Non-Goals (v1)

- Macro or calorie optimization
- Barcode scanning
- Branded food database
- Supplements
- Meal plans or recipes
- Social features
- Android support

## Positioning

**Source - Micronutrients, not macros.**
