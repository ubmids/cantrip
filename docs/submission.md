# Cantrip: #BuildHybridAI submission

The Devpost text and the demo script. Every `[[...]]` gets filled from a real run before submitting.

## Tagline

Say what to watch for. Gemini in the cloud writes and tests a program for Gemini Nano, which then checks every page you read, free and on your device.

## Inspiration

A job seeker reads dozens of posts a day. Some hide that there is no pay at all, or that you will be the one paying for a "starter kit". People in the US reported losing $501 million to job and employment agency scams in 2024, up from $90 million in 2020 (FTC). The signs are in the text, but nobody reads every post, email and review with a lawyer's eye. And a job search, an inbox or a pile of reviews is exactly the text you don't want to send to a server just to be warned about it.

On-device models are free, private and work offline. But they are small and fragile about prompting. Most people will never write a good prompt for Gemini Nano, and a prompt that works on one device's model often breaks on another. Big cloud models are the opposite: smart, but every call costs money and sends your text away.

So we asked: what if the cloud never saw your data at all? It would do only the one thing small models can't do for themselves, which is write and debug their own instructions.

## Who it's for

People who read things that might be traps, and want a second pair of eyes that costs nothing and tells no one: job seekers sorting real roles from commission-only and pay-to-work posts, anyone whose inbox gets "pay now or lose access" emails, shoppers wading through reviews. Each of them has a different trap, so Cantrip lets them describe their own in one sentence instead of waiting for someone to build a detector for it.

## What it does

You type a rule in plain English, like "Warn me when a job post is really commission-only."

1. Gemini in the cloud designs a small program for the on-device model. The program has labels, a system prompt, examples and a dozen test cases.
2. Cantrip runs every test on your device's model, live, and shows each pass and fail as it happens.
3. Gemini reads the failures, works out why the small model got them wrong, and rewrites the program. It always keeps the best version so far.
4. A third of the tests are held back from the repair loop, so the final "unseen tests" score is honest.
5. From then on, the program runs on Gemini Nano in Chrome on every page you read. Posts, cards and emails get a badge with the deciding words highlighted. There's no cloud call and no cost, it works offline, and the page text never leaves your machine.

The hosted app opens on a ready **Job-scam shield**: the commission-only program from a real compile on Gemini Nano, and five sample job posts. One click checks them, and you can paste any post of your own. If your browser has no Gemini Nano, Firebase AI Logic's hybrid mode runs those checks on Gemini in the cloud instead. The app says so before you press the button, allows 15 cloud checks per browser session, and marks every result "ran in the cloud: no on-device model here" or "ran on device".

Mark a verdict wrong and it becomes a new test, and Cantrip recompiles on your device. You can share a rule by a 7-character code. The repo also holds a SwiftUI iPhone app written to port a shared program to Apple's on-device Foundation Model. It builds for the iOS Simulator but has never run on a phone, so this submission is judged on the web app and the Chrome extension only.

## How we built it

Every model call goes through Firebase AI Logic.

- **Cloud compiler:** `getGenerativeModel` with `InferenceMode.ONLY_IN_CLOUD` and a JSON `responseSchema`. It only ever sees your rule and synthetic test texts.
- **Device runtime:** `InferenceMode.ONLY_ON_DEVICE` with `responseConstraint` for structured answers, and `initializeDeviceModel()` for the one-time download. It fails closed, so page text is never silently sent to the cloud.
- **Hybrid fallback, kept narrow:** in the web app, a ready program can run with `InferenceMode.PREFER_ON_DEVICE`: Gemini Nano when Chrome has it, `gemini-3.5-flash-lite` in the cloud when it doesn't. Only for text you pick or paste, announced before the run, and capped per session. Compiling stays on the device, because a program must be tested on the model that will run it, and the extension never sends a page to the cloud.
- **Where it ran:** every verdict shows `response.inferenceSource`, so you can see the split.
- **iPhone (not run yet):** the code uses the Firebase AI Logic iOS SDK with `FirebaseAI.SystemLanguageModel.default` and a fresh session per check. It builds for the Simulator only.
- **Firebase around it:**
  - App Check
  - anonymous Auth
  - Firestore for sharing, with rules that cap size and lock edits to the author
  - Remote Config for the compiler model, the round budget, the cloud fallback model and its per-session cap
  - Hosting for the web app
- **Surfaces:**
  - a web app
  - a Chrome MV3 extension with a side panel
  - a content script using the CSS Custom Highlight API
  - a SwiftUI iPhone app (builds for the Simulator, never run on a phone)

The compiler loop is plain TypeScript, with tests for the split, the repair loop, keeping the best version, holdout isolation, porting and learning from corrections.

### What was built when

The repository was created on 11 November 2026, the day the contest opened. Its first two commits (the compiler, the web app, the Chrome extension and the first iPhone sources) were pushed at 7:56 AM PT, about five and a half hours before the submission period opened at 1:30 PM PT. Those two commits are the only work that predates the period. Everything below was built during it: the Xcode project for the iPhone app, a web polish pass (honest device status, narrow layout, current Chrome requirements), the Firebase project, the hosted site, the first real compiles on Gemini Nano on 14 November, and the fixes those runs forced (a fallback when the compiler model is overloaded, keeping the best program when the cloud drops mid repair, programs that stay calm on page fragments, and a sharing fix). An AI coding assistant was used throughout.

## Challenges we ran into

- Small models overfit to whatever the repair step shows them. So we hold out a third of the tests and drop any example that copies a test.
- Gemini Nano has a tight token window and no multi-turn tools. So every check is a single self-contained prompt, clipped to 3,000 characters.
- Splitting a real web page into checkable pieces (a job card, an email, a review) without a parser for each site.
- The first compiler model we chose never answered on the free tier, so compiles hung for a minute. The compiler now falls back to a lighter model after 45 seconds, and the model is set in Remote Config.
- A network drop in the middle of the repair loop threw away a better program the loop already held. Now the best program so far is kept and the compile finishes.
- On a real job post, a paragraph of duties with no word about pay was flagged as unpaid. Programs had only been tested on whole posts. The compiler now asks Gemini for fragment tests, and the false flag went away on the same real paragraphs.
- Gemini Nano is not deterministic. One borderline email got three different labels on three runs, so a score can move by a test between runs.
- Firebase recommends reCAPTCHA Enterprise over reCAPTCHA v3 for new App Check integrations, so the hosted site uses reCAPTCHA Enterprise.

## Accomplishments we're proud of

- The hybrid split is the product, not a fallback: the cloud compiles, the device runs.
- On the commission-only rule, the compiler went from 8 of 9 to 9 of 9 on Gemini Nano in 2 rounds. It scored 3 of 3 on tests the repairs never saw, using 2 cloud calls and 21 runs on the device, in 85 seconds. The harder rules took all 4 rounds: the pressure-to-pay email rule went 5 of 8, 7 of 8, 7 of 8, 8 of 8 and then scored 3 of 4 on unseen tests, and the paid-review rule went 7, 7, 7, 8 of 8 and scored 4 of 4. The data-selling rule passed 9 of 9 on the first draft. Every one of the 105 test runs reported that it ran on the device.
- Running a compiled program made no network request at all, on localhost and on the hosted site. A check takes about 2 to 4 seconds on an M2 Pro laptop.
- A rule travels: share it by a 7-character code and it installs on another browser. A cantrip shared from localhost installed on the hosted site, through the real Firestore rules.

## What we learned

A big model that watches a small model fail on the real hardware can repair its prompt: three of our four rules needed repairs, and all three reached full marks on their tuning tests. Google's own Automated Prompt Optimization for ML Kit shows the idea works for developers offline. Cantrip does it live, for anyone, from one sentence.

## What's next

- Android, using ML Kit's on-device Prompt API.
- A public gallery of shared cantrips.
- Rules that act, not just flag: hide, collapse or summarise what matches.

## Built with

Firebase AI Logic, Gemini, Gemini Nano, Firebase App Check, Firebase Authentication, Cloud Firestore, Remote Config, Firebase Hosting, TypeScript, Vite, lit-html, Chrome Extensions (MV3). The iPhone app (builds, never run on a phone): Apple Foundation Models, Swift, SwiftUI.

## How to test it

- **Fastest:** the video shows the full loop on real hardware.
- **One click, any computer:** open https://sixth-trainer-388221.web.app and press **Check these 5 posts**. The Job-scam shield checks five sample job posts. Without Gemini Nano the checks run on Gemini in the cloud through Firebase AI Logic's hybrid mode, and each result says so (15 per browser session). **Paste your own post** checks any text.
- **The full loop, with Gemini Nano:** desktop Chrome 148 or later (about 22 GB of free disk space, and 16 GB of memory or a GPU with more than 4 GB of VRAM). Press **Download the model** once, pick **Commission-only jobs** under "Your own rule", press **Compile**, then **Try it** on the examples. A compile takes about 1 to 3 minutes, and every check then runs on your device.
- **See a compile without Gemini Nano:** https://sixth-trainer-388221.web.app/?preview is the compile interface with scripted answers. It says so on every screen, and no model runs in it.
- **Code without any keys:** `npm install && npm test` runs the compiler loop, the page splitter and the page badges against fake models.
- **The extension** needs its own Firebase project, because its App Check debug token can't be published. The README's "Run it" section has the steps.

## Links

- Hosted app: https://sixth-trainer-388221.web.app
- Video: [[YouTube URL]]
- Code: https://github.com/ubmids/cantrip

## Demo script (about 2 minutes 50 seconds)

The contest FAQ says judges may score from the video alone, and asks for who it's for, the problem and how Firebase AI Logic makes it work in the first 30 seconds. So the video opens on the result, not on the setup.

**Before recording**
- Load `dist/extension` (Developer mode, Load unpacked). Rebuild it first with `npm run build:extension` so it has the badge fix.
- Do one full dry run of the extension on `demo/jobs.html` and `demo/inbox.html` with Gemini Nano. This part has not been run on Gemini Nano yet, so check it before the take.
- Compile the **Commission-only jobs** cantrip in the side panel ahead of time and leave it on, for the cold open.
- Check the model once on `chrome://on-device-internals` and note its version for the description.
- Run one check after loading the page, because the first run after a page load took about 21 seconds while Chrome loaded the model.

**0:00 to 0:12, the cold open.**
- Screen: `demo/jobs.html` with the side panel open. Press **Read this page**. Badges land on the commission-only cards, with the deciding words highlighted.
- Voice: "An AI running on my laptop just checked every post on this job board. No cloud call, no cost, and the page never left my machine."

**0:12 to 0:30, who it's for and how.**
- Screen: hover a badge, then the side panel's "ran on this device" line.
- Voice: "Job seekers read dozens of posts a day, and people in the US reported losing 501 million dollars to job scams in 2024. A small model on your device could check every post for free, but small models are fragile, and nobody writes good prompts for them. So Cantrip splits the work. Gemini in the cloud writes and debugs the prompt. Gemini Nano on my device runs it. Both through Firebase AI Logic."

**0:30 to 0:45, a new rule in one sentence.**
- Switch to `demo/inbox.html`. Press the **Pressure-to-pay emails** chip and **Compile**.
- Voice: "Different trap, one sentence. Gemini writes a tiny program for Gemini Nano, and a dozen tests."

**0:45 to 1:35, the compile.**
- Let it run. Speed the footage up and put "sped up" on screen: on 14 November this rule took four rounds and about 2 minutes 47 seconds.
- Point at the meters: "Blue is the cloud, green is my device. Every one of these tests ran on Gemini Nano, here."
- When the repair note appears: "Gemini read what the small model got wrong, and rewrote the program."
- On the unseen tests: "A third of the tests were hidden from the repairs, so this last score is honest." Say the real score from the take, whatever it is.

**1:35 to 2:00, private and offline.**
- Press **Read this page** on the inbox. The pressure emails get badges and the friend's dinner email does not.
- Turn Wi-Fi off. Open DevTools on the Network tab. Press **Read again**. Badges come back and the Network tab stays empty.
- Voice: "Wi-Fi is off, and nothing was sent. Compiling needed the cloud once. Running never does."

**2:00 to 2:20, it learns.**
- Open a verdict that is wrong or borderline (the parcel email was borderline on 14 November), and press the right label.
- Voice: "Correct it once, and it becomes a test. Cantrip recompiles against it on my device."

**2:20 to 2:40, sharing.**
- Press **Share** and show the 7-character code.
- In a second Chrome profile, open the hosted site with the code. It installs with its scores. Run one example and show "ran on this device".
- Voice: "Rules travel by a code, and run on the next person's device with nothing sent."

**2:40 to 2:50, the close.**
- Voice: "The cloud writes the program. Your device runs it, on every page, for free. Cantrip, built on Firebase AI Logic."

Tips:
- Keep the take honest. If a round fails, leave it in, because the repair is the point.
- Put no third-party logos on screen. The demo pages use made-up companies for this reason.
- If the extension misbehaves on the day, record the cold open on the hosted app's own job board instead: **Check these 5 posts** with Gemini Nano on shows badges landing, highlights and "ran on device" on each card.
