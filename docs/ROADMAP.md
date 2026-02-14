# Source Roadmap (Current)

## Product Direction

Source should feel like an intuitive micronutrient signal system first, and a precision tracker second.

That means:
- default to low-friction estimate workflows,
- avoid false precision in uncertain CV outputs,
- still support exact tracking for users who want it.

## Current Priority: Dual Tracking Modes

### Mode A: Estimate (default)
- Goal: fast logging with honest uncertainty.
- Output style: gray/yellow/green nutrient signal bands.
- UI: no exact %DV numbers in primary summary surfaces.

### Mode B: Precise
- Goal: explicit totals for users who want detail.
- Output style: exact nutrient totals and %DV.
- UI: requires quantity + unit selection and conversion.

## Implementation Sequence

1. **Contract first**
   - Define meal-level `tracking_mode` (`estimate` | `precise`).
   - Persist mode per meal for provenance and mixed-day support.
2. **Global preference wiring**
   - Add app-level tracking preference (`estimate` | `precise`) for primary UX posture.
   - Write current preference to meal `tracking_mode` on save/recalculate.
3. **Estimate mode pass**
   - Add signal-band rendering in Capture/Home/History primary surfaces.
   - Keep copy explicit that this is directional and uncertainty-aware.
4. **Precise mode pass**
   - Add unit system and conversion pipeline (`g`, `oz`, `lb`, `ml`, `fl oz`, `cup`, etc.).
   - Keep internal normalization deterministic.
5. **Mixed-day behavior**
   - Define and implement consistent display when a day contains both estimate and precise meals.

## Near-Term Deliverables

- Tracking modes spec doc
- Migration adding `tracking_mode` to `meals`
- Global mode preference wiring
- Estimate-mode UI pass
- Precise-mode units pass

## Future Considerations

- Google OAuth end-to-end validation and hardening
- Account/profile surface
- Capture/history resilience and polish
