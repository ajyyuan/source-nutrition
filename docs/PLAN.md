# Source — 6-Day Build Plan

This plan defines build sequencing and priorities.
Each day should be treated as a hard boundary.

Cursor:
- may only implement the current day’s scope
- must not preemptively build future-day features
- should leave TODOs if future work is implied

## Status
- Days 1–6 complete.
- We are now in a post-plan iteration phase focused on product quality and feature expansion.
- The strict day-by-day constraints above no longer apply.

---

## Day 1 — App Skeleton & Plumbing

Goal:
- App runs end-to-end
- User can capture a photo and create a meal record

Scope:
- Expo app shell
- Navigation
- Auth (Supabase)
- Camera capture
- Image upload
- Create meal record in DB

Explicitly out of scope:
- AI parsing
- Nutrient computation
- Meal review UI
- Dashboards

---

## Day 2 — AI Parsing & Corrections

Goal:
- Photo → editable food list

Scope:
- Vision model call
- Strict JSON output
- Canonical food mapping (v1)
- Editable food list UI
- Portion adjustments

Explicitly out of scope:
- Nutrient totals
- Daily or weekly aggregation

---

## Day 3 — Micronutrient Engine

Goal:
- Accurate micronutrient output

Scope:
- Nutrient database subset
- Canonical food → nutrient mapping
- %DV computation
- Per-meal nutrient totals

Explicitly out of scope:
- Weekly views
- Additives logic

---

## Day 4 — Persistence & Trends

Goal:
- App feels like a real tracker

Scope:
- Save finalized meals
- Today view
- Daily totals
- 7-day rolling view

Explicitly out of scope:
- Subscriptions
- Export

---

## Day 5 — Robustness & Safety

Goal:
- App does not break

Scope:
- Edge case handling
- Failure modes
- Confidence labels
- App Store safety wording

Explicitly out of scope:
- UX polish beyond necessity

---

## Day 6 — Freeze & Submission

Goal:
- Submission-ready build

Scope:
- QA
- TestFlight build
- App Store metadata
- Bug fixes only

Explicitly out of scope:
- New features
- Refactors
