# Cantrip for iPhone

**Never run on a phone.** This app builds for the iOS Simulator but has not run on an iPhone,
so nothing here is a measured result and no iPhone result is claimed.

What it is written to do: install a cantrip someone compiled in Chrome by its share code, then,
on **Compile for this iPhone**, have Gemini (cloud) port the program from Gemini Nano to Apple's
on-device Foundation Model, run every test on the phone through Firebase AI Logic, repair what
fails and report the unseen-test score. Checks would then run on the phone with nothing sent.

It builds: `xcodebuild` for the iOS Simulator succeeds with Xcode 27.1 and firebase-ios-sdk 12.13+.
Running it on a phone needs the Firebase steps below.

## Build

1. Xcode 26 or later, an iPhone with Apple Intelligence turned on (iOS 26+).
2. `cd ios && xcodegen` (brew install xcodegen) makes `Cantrip.xcodeproj` from `project.yml`,
   with FirebaseAILogic, FirebaseFirestore and FirebaseAppCheck already added. Open it.
3. In the Firebase console add an iOS app with bundle id `net.subomi.cantrip` and drag its
   `GoogleService-Info.plist` into the Cantrip group in Xcode. The app does not start without it.
4. Pick your team under Signing & Capabilities, then run on the iPhone.
5. Run once, copy the App Check debug token from the Xcode console, and add it under
   **App Check > Apps > Manage debug tokens**.

## Where Firebase AI Logic is called

`Cantrip/Compiler.swift`: `FirebaseAI.firebaseAI(backend: .googleAI())`, the cloud compiler with
`generativeModel(modelName:)`, and the device runtime with
`generativeModelSession(model: FirebaseAI.SystemLanguageModel.default)`, a fresh session per
check. The code reads `rawResponse.modelVersion` to tell whether an answer came from the phone.
