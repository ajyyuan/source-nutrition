# Day 24 Handoff (Source)

Handoff for photo format (HEIC→JPEG), no-visible-food guard, beef cut canon names, parse-meal bundled canon lookup, and app icon.

## Session Intent (Founder)
- Fix TestFlight vision error: "unsupported image format" (iOS sending HEIC).
- Avoid hallucinated foods when user uploads black/blank photo.
- Align beef cut names in canon with "Beef chuck", "Beef strip steak", etc. (was only in DB before; now in repo canon).
- Have parse-meal use same canon as app so Parsed foods (AI) shows correct names without syncing DB.
- Set app logo from pasted assets.

## What Was Completed

### 1) Photo format (HEIC / vision API)
- **Issue:** Vision API rejects HEIC; TestFlight users got "unsupported image" and empty parse.
- **Client:** Upload always uses `.jpg` path and `contentType: image/jpeg`. Library picker uses `preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible` so iOS can return a compatible representation when possible.
- **parse-meal:** After downloading from storage, checks blob type is one of `image/jpeg`, `image/png`, `image/gif`, `image/webp`; otherwise throws clear error ("Unsupported image format. Please retake…").
- **No expo-image-manipulator:** Tried client-side JPEG conversion but native module was missing on device; reverted to path + content-type + Compatible mode.

### 2) No-visible-food (black/blank photo)
- **Issue:** Black screen produced fake high-confidence foods (e.g. ground beef, mozzarella).
- **Minimal fix:** One prompt rule in parse-meal: if basically no visible food (black frame, blank, lens covered, no food in frame), return `items = []`. No extra schema fields or dark/blur/obstructed logic.
- **Capture:** Only calls map-foods when `items && items.length > 0`. When parse returns zero items, user sees warning: "No visible food detected. Retake with the meal clearly in frame."

### 3) Beef cut names in canon
- **Goal:** Canon shows "Beef chuck", "Beef strip steak", etc., not "Chuck", "Strip steak"; single source of truth in repo.
- **source-canon-v1.json:** Beef cuts group items now have `display_name` like "Beef chuck", "Beef strip steak", "Beef ribeye", etc., and explicit `canonical_id` (e.g. `chuck`, `strip-steak`) so IDs stay stable for reseed/curation.
- **build-canon-v1.js:** Supports optional `canonical_id` on items; when present, uses it instead of slugifying display_name. Reserves that id in idCounts.
- **Manual curation:** Updated `canonical_name` for all 16 beef cut entries to match (e.g. "Beef chuck").
- **Pipeline:** canon:build → reseed:dry → k2 → mineral → matrix → top-foods → food-profiles → canon:lookup; matrix and foodProfiles now show Beef ribeye, Beef strip steak, Beef chuck, etc.

### 4) parse-meal uses bundled canon (no Supabase list)
- **Goal:** Parsed foods (AI) list uses same names as rest of app; no dependency on Supabase `canonical_foods` for catalog.
- **build-canon-lookup.js:** Writes same lookup array to both `supabase/functions/map-foods/canon-lookup.json` and `supabase/functions/parse-meal/canon-lookup.json` (run `npm run canon:lookup`).
- **parse-meal/index.ts:** Removed all Supabase reads for `canonical_foods` and `canonical_food_aliases`. Loads catalog via static import: `import canonLookupData from "./canon-lookup.json" assert { type: "json" };`. `loadCanonicalFoods()` filters to `usable` and builds same byId/byNormalizedLabel maps. No internal `fetch` — avoids "NetworkError when attempting to fetch resource" in edge runtime.
- **Result:** Capture "Parsed foods (AI)" shows Beef chuck, Beef strip steak, etc., in sync with foodProfiles and map-foods.

### 5) App icon
- **Assets:** `assets/Source.png`, `assets/Source-big.png`, `assets/Source-small.png`.
- **app.json:** `"icon": "./assets/Source.png"` under `expo`.
- **Note:** With existing native project (`npx expo run:ios --device`), the icon is read from `ios/Source/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`. To see the new logo without prebuild, replace that file with `Source-big.png` (or run `npx expo prebuild` to regenerate from app.json).

## Key Files Updated (This Session)
- **Canon:** `data/canon/source-canon-v1.json` (beef cuts display_name + canonical_id), `data/canon/source-canon-v1.manual-curation.json` (beef canonical_name), `scripts/build-canon-v1.js` (optional canonical_id).
- **Capture/parse:** `src/screens/CaptureScreen.tsx` (JPEG path, Compatible mode, map only when items.length > 0), `supabase/functions/parse-meal/index.ts` (format guard, no-visible-food prompt, bundled canon via static import, no DB canon reads).
- **Lookup:** `scripts/build-canon-lookup.js` (writes parse-meal/canon-lookup.json too), `supabase/functions/parse-meal/canon-lookup.json` (generated).
- **App:** `app.json` (icon path).

## Commits Landed
- Normalize capture uploads to JPEG and guard unsupported formats in parse-meal.
- Prevent black/blank photo hallucinations by returning empty parse items.
- Add explicit 'Beef' prefixes to canon beef cuts and keep stable canonical_ids.
- Use bundled canon lookup in parse-meal.

## Current State Snapshot
- **Photo upload:** Path is always `.jpg`; library uses Compatible representation; parse-meal rejects non–vision-allowed types with a clear message.
- **Parse:** No-visible-food returns empty items and a retake message; map-foods only runs when there are parsed items.
- **Canon:** Beef cuts are "Beef chuck", "Beef strip steak", etc., in source, flat, reseed, matrix, foodProfiles, and both canon-lookup files. parse-meal and map-foods both use bundled lookup; no Supabase canon reads for catalog.
- **Icon:** app.json points to `./assets/Source.png`; native icon may still be old until AppIcon asset is replaced or prebuild is run.
