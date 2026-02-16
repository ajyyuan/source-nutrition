# Unified Nutrient Experience Spec (v2)

> Legacy filename retained (`TRACKING_MODES_SPEC.md`) for continuity.

## Goal

Provide one clear nutrient-tracking experience that combines:
- uncertainty-aware signal bands (gray/yellow/green),
- visible `%DV` numeric context,
- quantity + unit meal editing.

This removes UX mode switching while preserving transparency.

## Scope

Applies to meal creation, nutrient rendering, and daily/weekly summaries.

## UX Contract

- No user-facing estimate/precise toggle.
- Nutrient bars show both:
  - color-banded signal interpretation,
  - `%DV` labels.
- Confidence language remains explicit and non-medical in parse/map-heavy surfaces.
- Disclaimers remain present across core summary flows.

## Data and Computation Rules

- Nutrient computation remains deterministic and server-side.
- `final_items` / `nutrient_totals` data model remains intact.
- Quantity/unit input remains supported and normalized to canonical units before nutrient math.

Initial unit set:
- mass: `g`, `oz`, `lb`
- volume: `ml`, `fl oz`, `cup`, `tbsp`, `tsp`

## Legacy `tracking_mode` Field

- `meals.tracking_mode` may remain in the DB for backward compatibility during transition.
- App UI no longer depends on it for presentation branching.
- Existing historical values do not require batch conversion for this v2 rollout.

## Non-Goals (v2)

- Personalized medical recommendations
- Clinical diagnosis/treatment logic
- Goal-driven RDA personalization without evidence/safety framework

## Safety Language Requirements

- Keep wording educational and informational.
- Avoid implying clinical certainty.
- Preserve explicit uncertainty framing where CV confidence is low.
