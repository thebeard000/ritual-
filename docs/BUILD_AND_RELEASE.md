# Building and downloading Ritual

## Current free delivery path

Every push to the main branch runs:

1. Source verification.
2. Web bundle preparation.
3. GitHub Pages deployment.
4. Capacitor Android project generation.
5. Android debug APK compilation.
6. APK artifact upload.

The Android artifact is named ritual-android-apk and contains Ritual-debug.apk.

## Why the first APK is debug-signed

The first goal is a free, installable APK for testing. Production distribution later requires a release keystore and signing credentials stored as GitHub Actions Secrets.

Never commit:
- a private keystore
- keystore passwords
- API secrets
- provider credentials

## Production release path

When Ritual is stable:
- create a production Android keystore
- store signing material as protected CI secrets
- generate a signed release APK/AAB
- create a GitHub Release
- later evaluate Play Store distribution and payments

## Important limitation

A browser/PWA cannot guarantee arbitrary background reminders on every Android/browser combination. The current implementation intentionally explains this instead of promising guaranteed delivery. Native Android scheduling can be added later without changing the local-first habit data model.
