# Cantrip: #BuildHybridAI submission

The Devpost text and the demo script. Every `[[...]]` gets filled from a real run before submitting.

## Tagline

Teach your browser a rule in one sentence. Gemini compiles it in the cloud, and your device runs it for free on every page.

## Inspiration

On-device models are free, private and work offline. But they are small and fragile about prompting. Most people will never write a good prompt for Gemini Nano, and a prompt that works on one device's model often breaks on another. Big cloud models are the opposite: smart, but every call costs money and sends your text away.

So we asked: what if the cloud never saw your data at all? It would do only the one thing small models can't do for themselves, which is write and debug their own instructions.

## What it does

You type a rule in plain English, like "Warn me when a job post is really commission-only."

1. Gemini in the cloud designs a small program for the on-device model. The program has labels, a system prompt, examples and a dozen test cases.
2. Cantrip runs every test on your device's model, live, and shows each pass and fail as it happens.
3. Gemini reads the failures, works out why the small model got them wrong, and rewrites the program. It always keeps the best version so far.
4. A third of the tests are held back from the repair loop, so the final "unseen tests" score is honest.
5. From then on, the program runs on Gemini Nano in Chrome on every page you read. Posts, cards and emails get a badge with the deciding words highlighted. There's no cloud call and no cost, it works offline, and the page text never leaves your machine.

Mark a verdict wrong and it becomes a new test, and Cantrip recompiles on your device. You can share a rule by a 7-character code. Install it on an iPhone and Gemini ports the program to Apple's on-device Foundation Model, then tunes it again on the phone.

## How we built it

Every model call goes through Firebase AI Logic.

- **Cloud compiler:** `getGenerativeModel` with `InferenceMode.ONLY_IN_CLOUD` and a JSON `responseSchema`. It only ever sees your rule and synthetic test texts.
- **Device runtime:** `InferenceMode.ONLY_ON_DEVICE` with `responseConstraint` for structured answers, and `initializeDeviceModel()` for the one-time download. It fails closed, so page text is never silently sent to the cloud.
- **Where it ran:** every verdict shows `response.inferenceSource`, so you can see the split.
- **iPhone:** the Firebase AI Logic iOS SDK with `FirebaseAI.SystemLanguageModel.default`. Each check gets a fresh session, and `rawResponse.modelVersion` confirms the answer came from the phone.
- **Firebase around it:**
  - App Check
  - anonymous Auth
  - Firestore for sharing, with rules that cap size and lock edits to the author
  - Remote Config for the compiler model and round budget
  - Hosting for the web app
- **Surfaces:**
  - a web app
  - a Chrome MV3 extension with a side panel
  - a content script using the CSS Custom Highlight API
  - a SwiftUI iPhone app

The compiler loop is plain TypeScript, with tests for the split, the repair loop, keeping the best version, holdout isolation, porting and learning from corrections.

[[One honest sentence on when it was built: started Nov 11, the day the contest opened, and finished during the submission period.]]

## Challenges we ran into

- Small models overfit to whatever the repair step shows them. So we hold out a third of the tests and drop any example that copies a test.
- Gemini Nano has a tight token window and no multi-turn tools. So every check is a single self-contained prompt, clipped to 3,000 characters.
- Apple's model keeps session history, which would leak one check into the next. So each check opens a new session.
- Splitting a real web page into checkable pieces (a job card, an email, a review) without a parser for each site.
- [[Real problems hit while running it on real devices, one line each.]]

## Accomplishments we're proud of

- The hybrid split is the product, not a fallback: the cloud compiles, the device runs.
- On the commission-only rule, the compiler went from [[first-round score]] to [[final score]] on Gemini Nano in [[N]] rounds. It scored [[holdout score]] on tests the repairs never saw, using [[cloud calls]] cloud calls.
- On iPhone, the same cantrip went from [[score]] to [[score]] after porting to Apple's model. [[Use only real numbers.]]
- One rule, two on-device models: the same cantrip runs on Gemini Nano in Chrome and on Apple's model on iPhone.

## What we learned

A big model watching a small model fail on real hardware is a much better prompt engineer than a person guessing. Google's own Automated Prompt Optimization for ML Kit shows the idea works for developers offline. Cantrip does it live, for anyone, from one sentence.

## What's next

- Android, using ML Kit's on-device Prompt API.
- A public gallery of shared cantrips.
- Rules that act, not just flag: hide, collapse or summarise what matches.

## Built with

Firebase AI Logic, Gemini, Gemini Nano, Apple Foundation Models, Firebase App Check, Firebase Authentication, Cloud Firestore, Remote Config, Firebase Hosting, TypeScript, Vite, lit-html, Chrome Extensions (MV3), Swift, SwiftUI.

## Links

- Hosted app: [[URL]]
- Video: [[YouTube URL]]
- Code: https://github.com/ubmids/cantrip

## Demo script (about 2 minutes 50 seconds)

**0:00 to 0:15, the hook.**
- Screen: a job board in Chrome.
- Voice: "Small AI models now run free and private on your laptop. The catch is they're fragile, and nobody writes good prompts for them. Cantrip lets the cloud write and debug the prompt, then gets out of the way."

**0:15 to 0:35, the rule.**
- Open the side panel, type "Warn me when a job post is really commission-only." and press Compile.
- Voice: "One sentence. Gemini in the cloud turns it into a tiny program for Gemini Nano, plus a dozen tests."

**0:35 to 1:20, the compile view.**
- Let round 1 run while the dots turn green and red.
- Point at the meters: "Blue is the cloud, green is my device. Every test is running on Gemini Nano right here."
- When the repair note appears: "Gemini read the failures and explains why the small model missed them."
- Round 2 passes.
- On the unseen tests: "A third of the tests were hidden from the repairs, so this score is honest."

**1:20 to 1:50, it runs on the page.**
- Press Read this page. Badges appear on the flagged job cards, with the deciding words highlighted.
- Voice: "Now it's free. Every post on this page was checked on my device. Nothing was sent anywhere."
- Turn Wi-Fi off and check another card: "It still works offline."

**1:50 to 2:10, it learns.**
- Mark one verdict wrong. It becomes a test, and Cantrip recompiles on the device.
- Voice: "Correct it once and it's a test forever."

**2:10 to 2:40, the second device.**
- Press Share and show the code.
- Cut to the iPhone: type the code and press Compile for this iPhone.
- Voice: "Different phone, different model. Gemini ports the program to Apple's on-device model and tunes it again on the phone."
- Show a check that says it ran on the iPhone with nothing sent.

**2:40 to 2:50, the close.**
- Voice: "The cloud compiles. Your device runs. Cantrip, built on Firebase AI Logic."

Tips:
- Compile once before recording so the models are downloaded.
- Keep the take honest. If a round fails, leave it in, because the repair is the point.
