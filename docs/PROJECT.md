# Source — Project Scope & Constraints

## Purpose

This document defines **what Source is allowed to be** for the MVP. It exists to prevent scope creep and guide both human and AI contributors.

---

## Target Timeline

* **Days 1–6:** Core features fully implemented and robust (complete)
* **Post-plan:** Feature expansion + UX polish before App Store submission
* **Submission:** Timing TBD once product quality is acceptable

This timeline is **high-risk but feasible** with strict scope control.

---

## Core Features (Locked)

### 1. Photo → Foods (AI)

* User captures a meal photo
* Vision model returns a structured list:

  * food name
  * estimated grams
  * confidence score
* Output is explicitly treated as an estimate

### 2. User Corrections

* Editable food list
* Portion (grams) adjustment
* Add / remove / replace foods
* Light clarifications only (v1-lite):

  * packaged vs homemade
  * wild vs farmed (where relevant)

### 3. Micronutrient Engine

* Vitamins, minerals, key fatty acids
* Per-meal, daily, and weekly totals
* %DV output
* Server-side computation

### 4. Persistence & History

* Meals saved by day
* Editable after creation
* Recalculation supported

### 5. Insights

* Today view: totals, top contributors, likely shortfalls
* 7-day view: averages, consistent wins, recurring gaps

### 6. Safety & Transparency

* Confidence labels everywhere
* No medical claims
* App Store-safe wording

---

## Explicitly Out of Scope (v1)

* Calories as a primary metric
* Macro optimization
* Barcode scanning
* Branded food DB
* Supplements or recommendations
* Meal plans
* Social features
* Android

---

## Platform Constraints

* iOS only
* Managed Expo
* Supabase for auth, DB, and storage

Any feature violating these constraints should be rejected.

---

## Decision Rule

If a feature is not required to:

* convert photos to micronutrient insight, or
* make that insight more accurate or usable

…it does not belong in v1.

---

## Dependency Freshness Rule

When implementing code that depends on external libraries or platforms
(e.g. Expo, React Native, Supabase, Apple APIs):

- Prefer current, non-deprecated APIs
- If there is ambiguity, assume the **latest stable version**
- Do not introduce migrations or alternative stacks
- Do not refactor existing code solely for “modernization”

If unsure:
- Leave a TODO comment referencing the uncertainty
- Do not block implementation

The goal is correctness and forward-compatibility,
not chasing the newest features.

---

## Security & Data Handling (Non-Negotiable)

- Follow least-privilege principles for auth and data access
- Never trust client input (including AI output)
- All sensitive logic runs server-side
- Do not log secrets, tokens, or raw images
- Prefer platform-native secure storage and APIs
- Fix known high-severity production vulnerabilities when practical

Security should be **adequate and pragmatic**, not over-engineered.
If a security decision is unclear, choose the safer option or leave a TODO.
