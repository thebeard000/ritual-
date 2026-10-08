# Ritual Product & Engineering Specification

## Product
Ritual is a premium, local-first habit and discipline application. The first release must remain usable at $0 / ₹0 without requiring a paid backend.

## Non-negotiable product decisions
- Mobile-first and installable.
- Android must be a real packaged application, not a simulated phone frame around a web page.
- The browser/PWA remains supported.
- Android/browser system UI supplies the real clock, Wi-Fi/mobile signal, battery, notifications, and navigation chrome. Ritual must never draw fake device status bars.
- The same Ritual brand identity is used in the web app, PWA icon, Android launcher icon, splash and share cards.
- Core data is local-first and works offline.
- No real secret API key is ever committed to Git, shipped in the frontend bundle, or embedded in an APK.
- Future private API calls must use a server/proxy or equivalent secure boundary.
- Backup/restore must be user-controlled.
- Achievement sharing should work without a server.
- Do not claim a capability is guaranteed when browser/OS restrictions make it platform dependent.

## Core experience
1. Lightweight onboarding/profile.
2. Today: scheduled habits, completion state, streak and daily progress.
3. Habits: create, edit, archive, reorder, schedule, goals/quantities and reminders.
4. Progress: completion trends, streaks, calendar/history and consistency.
5. Achievements: meaningful milestones and shareable achievement cards.
6. Profile/settings: identity, theme, notifications, backup/restore and app information.
7. Local-first persistence with stable identifiers and timestamps.

## Architecture direction
- Keep the current lightweight web stack unless a migration provides a clear, tested benefit.
- Capacitor is the Android packaging boundary.
- Service-worker caching supports offline PWA operation.
- Keep future API integration behind a small provider/service abstraction.
- Prefer Web APIs and local storage/IndexedDB over paid infrastructure for core features.
- Avoid adding large frameworks solely for appearance.

## Mobile quality bar
- Respect safe-area insets.
- No fixed fake device dimensions on real devices.
- Touch targets should be comfortably usable.
- Forms must behave correctly with the mobile keyboard.
- Scrolling must not trap the user unnecessarily.
- Support light, dark and system themes.
- Support reduced-motion preferences.
- Handle empty, loading, error and permission-denied states.
- Maintain accessible labels and visible focus for keyboard users.

## Android delivery
- Application ID: com.ritual.habittracker
- App name: Ritual
- Debug APK is the first free downloadable artifact.
- Production release signing must use GitHub Secrets; passwords/keystores must never be committed.
- CI must verify the source, build the web bundle, deploy Pages, build Android, and publish the APK artifact.
- A successful APK claim requires an actual successful CI build.

## Reference-project lessons
The supplied reference repositories are inspiration for engineering discipline, modularity, persistent context, AI/API readiness, CI/testing and polished product presentation. They are not dependencies of Ritual and should not be copied wholesale.

## Future roadmap
- Secure backend/API layer.
- Optional account/cloud sync.
- Native Android reminder scheduling.
- Payment/subscription layer only after the free product is stable.
- Store distribution and production signing.
