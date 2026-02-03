# Apple Sign In (Expo + Supabase) – Setup & Fixes

This project uses **native Sign in with Apple** (via `expo-apple-authentication`) and exchanges the Apple `identityToken` with Supabase using `supabase.auth.signInWithIdToken({ provider: 'apple' })`.

## What must be true for it to work

- **Apple Developer (App ID / bundle ID)**
  - Bundle ID: `com.andrewyuan.source`
  - The App ID must have **Sign In with Apple** capability enabled.
  - The provisioning profile used to sign the app must include the `com.apple.developer.applesignin` entitlement.

- **iOS app (entitlements + Info.plist)**
  - `ios/Source/Source.entitlements` must include:
    - `com.apple.developer.applesignin` → `Default`
  - `CFBundleAllowMixedLocalizations` should be `true` (already present in `ios/Source/Info.plist`).

- **Supabase**
  - In **Auth → Providers → Apple**, enable Apple.
  - Under **Client IDs**, add:
    - `com.andrewyuan.source`
    - `host.exp.Exponent` (only if you’re testing via Expo Go)
  - If you are using **native-only** Apple sign-in (recommended for iOS), you **do not** need the OAuth “Services ID / Secret” config.

## Repo changes already applied

- `src/screens/AuthScreen.tsx`
  - Uses `AppleAuthenticationButton` (required by Apple guidelines).
  - Uses a nonce (raw + SHA256) and exchanges `identityToken` via `signInWithIdToken`.
  - Saves `full_name` to Supabase user metadata on first sign-in (Apple only returns name once).
- `ios/Source.xcodeproj/project.pbxproj`
  - Ensures `Source.entitlements` is referenced in the Xcode project and adds a `SystemCapabilities` entry for `com.apple.developer.applesignin`.

## If Apple sign-in still fails on device

### 1) Make sure the App ID capability is enabled in Apple Developer

In Apple Developer → **Identifiers** → App ID `com.andrewyuan.source`:
- Turn on **Sign In with Apple**
- Save

Then, in Xcode:
- Open `ios/Source.xcworkspace`
- Target **Source** → **Signing & Capabilities**
- Ensure **Automatically manage signing** is ON
- Ensure **Sign In with Apple** capability is present

If Xcode complains about provisioning profiles, delete/regenerate profiles and let Xcode recreate them automatically.

### 2) Rebuild a “clean” device build

If you’ve changed `app.json` plugins/ios config recently, ensure the native project isn’t stale:

```bash
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
npx expo run:ios --device
```

### 3) Verify entitlements actually made it into the signed app

After a device build, inspect the built `.app`:

```bash
codesign -d --entitlements :- "<PATH_TO>/Source.app"
```

You should see `com.apple.developer.applesignin` in the output.

## Notes

- Supabase Apple **OAuth web flow** (`signInWithOAuth({ provider: 'apple' })`) is a separate configuration and requires Services ID + secret rotation. The goal here is **native iOS Apple sign-in**, which avoids that.

