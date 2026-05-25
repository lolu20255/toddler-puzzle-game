# Capacitor — native iOS & Android

The game is a Vue 3 + Vite + Phaser web app wrapped with [Capacitor](https://capacitorjs.com)
to ship on the App Store and Google Play. The architecture mirrors the
Coinvertor app.

## Architecture

The web app is unchanged; native capabilities live behind a small service
layer in `src/services/`, each module a singleton that **degrades to a safe
no-op in the browser** so `npm run dev` keeps working.

| File | Responsibility |
|------|----------------|
| `platform.js` | Runtime checks — `isNativePlatform()`, `isIOS()`, `isAndroid()` |
| `storage.js` | Key/value storage (`@capacitor/preferences`, web-safe) |
| `haptics.js` | Tactile feedback — `tap()`, `medium()`, `success()`, `selection()` |
| `purchases.js` | In-app purchases via RevenueCat (`premium` entitlement) |
| `notifications.js` | Local reminders + remote push |
| `appReview.js` | Native review prompt + store deep link |
| `analytics.js` | Privacy-safe, anonymous, local-only event tracking |
| `native.js` | `initNative()` — boots everything; called from `src/main.js` |
| `index.js` | Barrel — `import { haptics, purchasesService } from '@/services'` |

`capacitor.config.json` holds the app id (`com.blackboxcode.toddlerpuzzle`),
name, `webDir: dist`, and SplashScreen / StatusBar / PushNotifications config.

## Build & run

Prerequisites: Xcode + CocoaPods (iOS), Android Studio + JDK 17/21 (Android).

```bash
npm run build:ios       # build web app → sync → open Xcode
npm run build:android   # build web app → sync → open Android Studio
npm run cap:sync        # re-sync web build into both native projects
npm run cap:assets      # regenerate icons/splash from assets/
```

Build-script flags: `-s` skip web build, `-d` run on device, `-n` don't open
the IDE; Android also has `-a` (debug APK) and `-b` (release AAB).

The native `ios/` and `android/` folders are committed to git; their generated
`.gitignore` files exclude Pods/build artifacts.

## One-time native setup (before release)

### RevenueCat (in-app purchases)
1. Create an app on [RevenueCat](https://app.revenuecat.com); add the iOS and
   Android apps.
2. Create products in App Store Connect / Google Play, link them to a
   `premium` entitlement, and put them in the default offering.
3. Copy the public SDK keys into `.env` (`VITE_REVENUECAT_API_KEY_IOS` /
   `_ANDROID`) — see `.env.example`.

### Push notifications
- **iOS**: enable the *Push Notifications* capability in Xcode; create an APNs
  key in the Apple Developer portal and upload it to your push provider.
- **Android**: create a Firebase project, add the app, drop
  `google-services.json` into `android/app/`.
- Local notifications (`notificationsService.schedulePlayReminder()`) need none
  of this — they work out of the box.

### Store URLs
Fill `VITE_PROD_IOS_LINK` / `VITE_PROD_ANDROID_LINK` in `.env` once the
listings exist, so the in-app "Rate us" deep link works.

### App art
Add real icon/splash art to `assets/` (see `assets/README.md`), then
`npm run cap:assets`.

### Android release signing
Configure a keystore + signing config in `android/app/build.gradle` before
building a release AAB.

## ⚠️ Kids-app compliance

This is a children's app — it must follow the **Apple Kids Category** and
**Google Play Families** policies, plus **COPPA / GDPR-K**:

- Any UI that calls `purchasesService.purchasePackage()` **must sit behind a
  parental gate** (e.g. "Ask a grown-up: what is 7 + 4?").
- `analytics.js` is intentionally anonymous and local-only — do not wire it to
  Firebase / Amplitude / GA, which collect device identifiers.
- Notifications are never requested on launch; prompt only on explicit opt-in.
- No ads and no ad tracking are included, by design.
