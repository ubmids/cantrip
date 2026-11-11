# Cantrip for iPhone

The second platform for #BuildHybridAI. Install a cantrip someone compiled in Chrome by its
share code, then press **Compile for this iPhone**: Gemini (cloud) ports the program from
Gemini Nano to Apple's on-device Foundation Model, runs every test on the phone through
Firebase AI Logic, repairs what fails and reports the unseen-test score. Checks then run on
the phone with nothing sent.

Not built yet: this was written without Xcode, so expect a few compile fixes on first build.

## Build

1. Xcode 26 or later, an iPhone with Apple Intelligence turned on (iOS 26+).
2. New iOS App project named Cantrip (SwiftUI). Replace its sources with the files in `Cantrip/`.
3. File > Add Package Dependencies: `https://github.com/firebase/firebase-ios-sdk`, version
   12.13.0 or later. Add **FirebaseAILogic**, **FirebaseFirestore** and **FirebaseAppCheck**.
4. In the Firebase console add an iOS app with your bundle id and drop `GoogleService-Info.plist`
   into the project.
5. Run once, copy the App Check debug token from the Xcode console, and add it under
   **App Check > Apps > Manage debug tokens**.

## Where Firebase AI Logic is called

`Cantrip/Compiler.swift`: `FirebaseAI.firebaseAI(backend: .googleAI())`, the cloud compiler with
`generativeModel(modelName:)`, and the device runtime with
`generativeModelSession(model: FirebaseAI.SystemLanguageModel.default)`, a fresh session per
check. `rawResponse.modelVersion` shows whether an answer came from the phone.
