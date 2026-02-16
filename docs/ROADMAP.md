# Source Roadmap (Current)

## Product Direction

Source should feel like a clear micronutrient signal system with visible numeric context, without forcing users to pick between separate UX modes.

That means:
- keep uncertainty communication explicit (bands + confidence + disclaimers),
- keep `%DV` visible for interpretability,
- keep quantity + unit editing available for better meal quality,
- avoid clinical or prescriptive guidance.

## Current Priority: Unified Nutrient Experience

### Core UX Contract
- Single app experience (no estimate/precise mode toggle).
- Primary nutrient surfaces show:
  - signal bands (gray/yellow/green),
  - `%DV` labels on nutrient bars.
- Confidence remains visible where model uncertainty is highest (parse/map flows).

### Data Contract (Transitional)
- Meal-level `tracking_mode` may remain in DB for backward compatibility.
- App should not depend on mode-specific branching for core rendering.
- Nutrient computation remains deterministic and server-side.

## Near-Term Deliverables

1. Complete single-mode cleanup across UI and docs.
2. Improve food mapping coverage and CV robustness.
3. Add QA checklist for capture/edit/restart regression cases.

## Future Concepts (Founder Notes)

1. Nutrient drill-down interaction:
   - tap a nutrient to see high-source foods and context.
2. Ingredient detail interaction:
   - tap an ingredient to see per-100g profile and notes.
3. Bioavailability layer:
   - informational bioavailability notes/scores with conservative wording.
4. Effective RDA research thread:
   - investigate how goals or context might affect interpretation.
   - keep this as research/discovery only until safety, evidence quality, and legal framing are defined.

## Safety Guardrails for Future Concepts

- No personalized medical advice.
- No diagnosis/treatment framing.
- Prefer educational wording and transparent uncertainty.
