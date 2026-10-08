# Ritual

**Ritual** is a premium, local-first habit tracker built around one idea:

> Small habits. Kept daily.

## Platforms

- Installable PWA on GitHub Pages
- Real Android application built with Capacitor
- Offline-first local experience with no account required

The app includes habits, schedules, streaks, progress analytics, journal entries, achievements, themes, local profile data, reminders, sharing, and JSON backup/restore.

## Download the Android APK

Each push to `main` and each manual workflow run builds a debug APK.

1. Open **Actions** in GitHub.
2. Open **Build Ritual Web + Android APK**.
3. Open a successful run.
4. Download the **ritual-android-apk** artifact.

The APK is a real Android application using Capacitor's native container. It does not display the old simulated phone frame. Android supplies the real status bar, system clock, Wi-Fi/cellular indicators, and navigation bar.

## Local Android build

Requirements: Node.js 22+, Android Studio/SDK, Java 17.

```bash
npm install
npm run prepare:web
npm run android:add
npx @capacitor/assets generate --android --assetPath assets
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Branding

Ritual uses a charcoal + warm ivory + sage-green palette. The source mark is:

`brand/ritual-mark.svg`

Capacitor uses:

`assets/icon.svg`

## API roadmap

No API key is needed for the current app. See `API_CONFIGURATION.md` before adding any future API integration.

## Zero-cost architecture

Ritual currently avoids a paid backend, hosted database, and subscription. Local data stays on-device and can be exported as JSON.
