 # Day 6 Handoff (Source)
 
 This file captures non-repo state and operational context for continuing after Day 6.
 
 ## Project Status (Day 6 complete: freeze + TestFlight)
 - TestFlight build uploaded and processed successfully.
 - Internal testing group created and build assigned.
 - Export compliance answered (no custom encryption).
 - App Store metadata draft added to repo.
 
 ## TestFlight / App Store Connect State
 - App: `Source - Nutrition First`
 - Version: `0.1.0`
 - Builds uploaded: `1`, `2`, `3`, `4`
 - Latest build: `0.1.0 (4)` is attached to Internal Testing group and shows Ready to Submit.
 - Internal testing group name: `Internal Testing`
 - Tester added: `andrewyuan@gmail.com` (invited)
 - Export compliance set to "None of the algorithms mentioned above".
 - Older builds (1-3) still show Missing Compliance (can ignore or update if needed).
 
 ## Warnings During Upload
 - dSYM upload warnings for `React`, `ReactNativeDependencies`, and `hermes`.
 - Upload still succeeded; crash symbolication may be limited.
 - Optional fix: set Release `Debug Information Format` to "DWARF with dSYM File", Clean Build Folder, re-archive.
 
 ## Notable Files / Changes
 - `docs/APP_STORE_METADATA_DAY6.md`
   - Draft App Store metadata + TestFlight "What to Test".
   - Replace placeholder URLs before submission.

 ## How to Run
 1) `npm install`
 2) `npx expo run:ios --device`
 
 ## Next Steps
 - Fill Support/Marketing/Privacy URLs in `docs/APP_STORE_METADATA_DAY6.md`.
 - Add App Store Connect metadata fields (subtitle, description, keywords).
 - If desired, resolve dSYM warnings and upload a new build.

 
