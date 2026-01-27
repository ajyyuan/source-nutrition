# Day 6 QA Checklist

Run on a physical iOS device. Simulator camera capture is unreliable.

## Setup
- `npm install`
- `npx expo run:ios --device`
- Confirm `.env` has Supabase URL + anon key
- Confirm `OPENAI_API_KEY` is set in Supabase for `parse-meal`

## Capture + Parse
- Capture a clear meal photo (multiple foods)
- Confirm upload completes and a meal record is created
- Confirm parse returns a food list (name, grams, confidence)
- Confirm confidence labels show as estimates

## Edit Foods
- Adjust grams for an item; totals update after save
- Remove an item; totals update after save
- Add a new item manually; totals update after save
- Replace an item with a different food; totals update after save

## Nutrients + Insights
- Verify per-meal nutrient totals appear
- Verify %DV values appear
- Home screen shows Top contributors and Likely shortfalls
- Confidence/estimate language is visible in nutrient summaries

## History + Persistence
- Close and relaunch app; meals still present
- Edit a prior meal; recomputed totals persist
- Create meals on different days; 7-day view updates

## Failure Modes
- Unset `OPENAI_API_KEY` and re-parse; warning shown, no crash
- Take a dark/unclear photo; AI returns fewer items, no crash
- Cancel capture mid-flow; no orphaned UI state

## Safety Wording
- No medical claims anywhere in UI
- Clear estimate/uncertainty wording on AI outputs
