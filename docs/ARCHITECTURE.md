# Source — Architecture Overview

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

Every meal should also carry a `tracking_mode` (`estimate` | `precise`) that controls presentation and UX contract.

In v1, the frontend also maintains an app-level tracking mode preference (`estimate` | `precise`).
That preference controls primary UI posture and is written into `meals.tracking_mode` when meals are saved/recalculated.

---

## Nutrient Computation

* Canonical food ID → nutrient vector per 100g
* Multiply by grams
* Aggregate per meal → day → week
* Compute %DV using fixed constants

All computation happens **server-side**.

Tracking mode does not relax determinism requirements; it changes how outputs are presented and how user input is collected.

---

## Canon Source Resolution Contract

* Canon list (`source-canon-v1`) is the gold item set.
* Canon ID resolution is strict and explicit.
* Runtime map/parse flow does **not** rely on heuristic fallback food substitution.
* Reseed flow is curation-first:
  * each canon row must map to an explicit source row
  * strict reseed fails if canon rows are unresolved/unusable
* Source rows can come from:
  * local USDA CSV datasets
  * online USDA API rows
  * approved supplemental external datasets (for hard gaps)

Provenance artifacts:
* `data/canon/source-canon-v1.manual-curation.json`
* `data/canon/source-canon-v1.supplemental-source-rows.json`
* `data/canon/source-canon-v1.provenance.json`

---

## Architectural Non-Negotiables

* Canonical food IDs must be stable
* Nutrient computation must be deterministic
* AI output must be validated before use
* Frontend must never guess nutrients

Breaking these rules will cause future rewrites.
