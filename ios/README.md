# Cantrip for iPhone

The second platform for #BuildHybridAI. Install a cantrip someone compiled in Chrome by its
share code, then press **Compile for this iPhone**: Gemini (cloud) ports the program from
Gemini Nano to Apple's on-device Foundation Model, runs every test on the phone through
Firebase AI Logic, repairs what fails and reports the unseen-test score. Checks then run on
the phone with nothing sent.

It builds: `xcodebuild` for the iOS Simulator succeeds with Xcode 27.1 and firebase-ios-sdk 12.13+.
It has not run on a phone yet, because that needs the Firebase steps below.

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
check. `rawResponse.modelVersion` shows whether an answer came from the phone.
