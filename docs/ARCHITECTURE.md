# Intake — Architecture Overview

## High-Level System

**Frontend (Expo RN, iOS)**
→ uploads meal photo
→ displays AI-parsed foods
→ allows user corrections
→ shows nutrient summaries

**Backend (API + Supabase)**
→ stores images
→ runs AI parsing
→ canonicalizes foods
→ computes nutrients
→ persists meals + aggregates

---

## Core Pipeline

1. User captures photo
2. Image uploaded to storage
3. Meal record created
4. Vision model parses foods
5. Output validated against strict JSON schema
6. Foods mapped to canonical IDs
7. User edits final items
8. Backend computes nutrients
9. Results cached and persisted

---

## Key Design Choice: Dual Food Representation

Each meal stores two versions of food data:

### parsed_items

* Raw AI output
* Versioned by model_version
* Never overwritten

### final_items

* User-approved canonical foods + grams
* Used for all nutrient computation

**IMPORTANT:** These must never be merged.

This enables:

* model upgrades
* nutrient DB upgrades
* safe recomputation

---

## Versioning

Every meal stores:

* model_version
* nutrient_db_version

Nutrient totals can be recomputed when versions change.

---

## Nutrient Computation

* Canonical food ID → nutrient vector per 100g
* Multiply by grams
* Aggregate per meal → day → week
* Compute %DV using fixed constants

All computation happens **server-side**.

---

## Architectural Non-Negotiables

* Canonical food IDs must be stable
* Nutrient computation must be deterministic
* AI output must be validated before use
* Frontend must never guess nutrients

Breaking these rules will cause future rewrites.
