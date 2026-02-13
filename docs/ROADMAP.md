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
   - Keep mode per meal for v1 (not per item/account).
2. **Estimate mode first**
   - Add signal-band rendering in Capture/Home/History.
   - Keep copy explicit that this is directional.
3. **Precise mode next**
   - Add unit system and conversion pipeline (`g`, `oz`, `lb`, `ml`, `fl oz`, `cup`, etc.).
   - Keep internal normalization deterministic.
4. **Mixed-day behavior**
   - Define and implement consistent display when a day contains both estimate and precise meals.

## Near-Term Deliverables

- Tracking modes spec doc
- Migration adding `tracking_mode` to `meals`
- Estimate-mode UI pass
- Precise-mode units pass

## Future Considerations

- Google OAuth end-to-end validation and hardening
- Account/profile surface
- Capture/history resilience and polish
