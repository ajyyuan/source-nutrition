# Source

Source is an iOS app that turns meal photos into micronutrient insight.

Instead of asking "How many calories did I eat?", Source asks:

> "What did this food actually give my body?"

## Current Product Direction

Source is evolving toward two tracking experiences:

- **Estimate mode (default):** low-friction, uncertainty-aware nutrient signals
- **Precise mode:** explicit quantities and unit-based exact totals

This keeps the app honest when CV confidence is imperfect while still supporting users who want precision.

## Current Status

- iOS app in active development (Expo + Supabase)
- Native Apple sign-in working
- Google OAuth available in UI
- Magic-link auth removed from app flow

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
- Tracking mode spec: `docs/TRACKING_MODES_SPEC.md`
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
