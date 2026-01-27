# Day 6 TestFlight Prep

This is a minimal, submission-ready checklist. Prefer a physical device build before archiving.

## Preflight
- Confirm Apple Developer account access
- Confirm bundle ID: `com.andrewyuan.source`
- Set a new build number in Xcode or add `ios.buildNumber` in `app.json`

## Build (Xcode archive)
- `npm install`
- `npx expo run:ios --device`
- In Xcode: Product → Archive
- In Organizer: Distribute App → App Store Connect → Upload

## App Store Connect
- In TestFlight: add build to internal testing group
- Verify processing completes without errors

## Notes
- If you prefer EAS: create an `eas.json` and use `eas build -p ios`
- Keep version/build incremented for each upload
