Paste everything below the line into Claude Code on your Mac, from the folder where you keep repos.

---

You're helping me finish my entry for Google's #BuildHybridAI hackathon on Devpost (https://firebasehybridaihackathon.devpost.com). The entry is **Cantrip**, in my repo `ubmids/cantrip`. You type a rule in plain English. Gemini in the cloud compiles it into a small program for the on-device model, runs tests on the device, repairs what fails and reports a score on held-out tests. Then the program runs free and offline on every page (Gemini Nano in Chrome) and on iPhone (Apple's Foundation Model). Every model call goes through Firebase AI Logic.

What exists: a web app, a Chrome MV3 extension and the compiler in TypeScript (19 passing tests), plus an iPhone app in `ios/Cantrip/`. Open PR #3 (`ios-xcode-project`) adds an Xcode project generated with xcodegen that builds for the Simulator, but the app has never run on a phone. Nobody has run any of it against a real Firebase project or a real on-device model, or looked at the screens. Your job is to make all of it really work, make it look finished, and get the submission ready. Submissions close **Mon Nov 30, 2026, 2:00 PM PT**.

## Ground rules

- **Stop and ask me before** anything that creates an account or project, accepts terms, spends money or turns on billing, makes the repo public, publishes anything (Firebase Hosting deploy, a YouTube upload, a Chrome Web Store listing), registers me for the hackathon, or submits on Devpost. Tell me in one line what you're about to do and what it costs, and wait for my yes.
- **I do all sign-ins myself** (Google, Firebase, Apple, GitHub, Devpost, YouTube). When a page needs one, stop and tell me. Never type or store a password.
- **No keys or tokens in git**: not the App Check debug token, not `.env`, not `GoogleService-Info.plist`. Check `git diff --cached` before every commit.
- Work on branches and open PRs to `main`. Merge only when I say so.
- Use Claude in Chrome for the consoles and to look at every screen. When something looks wrong, fix it. Don't just report it.
- Before you trust anything in this prompt about Firebase, Chrome flags, Xcode or package versions, check the current official docs. This prompt was written on Nov 14 and APIs move. The official rules are at https://firebasehybridaihackathon.devpost.com/rules. Read them first.

## 1. Repo and local checks

1. Clone `git@github.com:ubmids/cantrip.git`, or pull `main` if I already have it.
2. Run `npm ci && npm test && npm run typecheck && npm run build:all`. Everything should pass. If not, fix it and show me what changed.
3. List the open PRs on `ubmids/cantrip` and tell me what each is. PR #3 is the Xcode project; ask me whether to merge it before step 5.
4. Read `README.md`, `ios/README.md`, `src/firebase/*.ts`, `src/core/*.ts` and `docs/submission.md` so you know the design before you touch it.

## 2. Firebase project (in Chrome, Firebase console)

1. Ask me which Google account to use, and whether to create a new project (suggested name `cantrip-hybrid`) or use an existing one. Creating it accepts Firebase's terms, so wait for my yes.
2. Stay on the free Spark plan unless something truly needs Blaze. If it does, tell me what and why, and ask.
3. **AI Services > AI Logic**: choose the **Gemini Developer API** and finish the guided setup.
4. Register a **web app**. Put its config in `.env`, starting from `.env.example`.
5. **App Check**: create a debug token (App Check > Apps > Manage debug tokens) and put it in `.env` as `VITE_APPCHECK_DEBUG_TOKEN`. For the hosted site, `src/firebase/app.ts` uses `ReCaptchaEnterpriseProvider`. If reCAPTCHA Enterprise needs billing or a paid setup, ask me. The alternative is switching to `ReCaptchaV3Provider` with a free reCAPTCHA v3 key, which is a small code change.
6. Turn on **Authentication > Anonymous**. Create **Firestore** in production mode, in the region nearest Lagos that the console offers.
7. Install the Firebase CLI with `npm i -g firebase-tools`. I run `firebase login` myself. Then run `firebase use --add` and deploy the Firestore rules: `firebase deploy --only firestore:rules`.
8. Optional: in **Remote Config**, set `compiler_model` and `max_rounds`. First check which Gemini model names AI Logic currently serves. The code defaults to `gemini-3.8-flash` for the compiler and falls back to `gemini-3.5-flash-lite`. Update the defaults in `src/firebase/` if those names are wrong.

## 3. Chrome with the on-device model

1. Find from Chrome's current docs exactly what the Prompt API and the built-in model need now: Chrome version, flags (the code assumes `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`), disk space and hardware.
2. Set it up on my Mac and confirm `await LanguageModel.availability()` in the DevTools console.
3. If the flag names or the API shape changed, update `src/firebase/ai.ts`, the README and the in-app setup banner.

## 4. Make the web app and extension really work

1. Run `npm run dev` and open it in Chrome.
2. Compile each of the four samples in `src/ui/samples.ts` for real.
3. For each one, record:
   - the score per round
   - the score on unseen tests
   - the number of cloud calls and device runs
   - the time taken
4. Fix whatever breaks. Likely spots:
   - JSON that Gemini Nano returns despite `responseConstraint`
   - the token limit
   - `initializeDeviceModel` needing a user gesture
   - App Check errors
   - repairs that go backwards

   Keep the compiler's tests green, and add a test for each real bug you fix.
5. Check that every verdict's source badge says it ran on the device, and that nothing is sent to the cloud when running a program (`ONLY_ON_DEVICE`). Watch the Network tab while you test to confirm it.
6. **Design pass**: screenshot every screen in light and dark mode, at full width and at a narrow width. These include the composer, the compile view, the detail and try-it view, the library, install-by-code, and the extension side panel. Judges score "a complete, coherent product experience", so fix anything clumsy: spacing, empty states, error states, long text, loading states. Show me the before and after for the main screens.
7. Build the extension with `npm run build:extension`. Load `dist/extension` unpacked at `chrome://extensions`, then:
   - Test **Read this page** on two or three real job boards and an inbox-style page.
   - Test the right-click **Check with Cantrip** on selected text.
   - Make sure badges and highlights land on the right blocks.
8. Test sharing: share a cantrip from the web app and install it by code in the extension.

## 5. iPhone app (Xcode)

1. Ask me which Apple team and bundle id to use (suggested `com.<my team>.cantrip`). If my free personal team can't do what's needed, tell me before anything that costs money.
2. Use the Xcode project from PR #3 (`ios/project.yml` and `ios/Cantrip.xcodeproj`; regenerate it with `xcodegen` after changing `project.yml`). Set the signing team and bundle id there.
3. Check that the Firebase package version supports `FirebaseAI.SystemLanguageModel` (Apple Foundation Models through AI Logic). The Swift API names in `Compiler.swift` were written from the docs, and the Simulator build only shows that they compile, not that they work on a device.
4. Register an **iOS app** in the same Firebase project and add `GoogleService-Info.plist` to the project. Add it to `.gitignore`.
5. Build, then fix compile errors until it builds clean. Run it on my iPhone, which needs Apple Intelligence on. Register the App Check debug token that it prints in the Xcode console.
6. Test end to end:
   - Install a cantrip by the share code from step 4.
   - Press **Compile for this iPhone**.
   - Watch the rounds.
   - Run a check.

   Confirm the check says it ran on the iPhone. Record the scores like in step 4.
7. Commit any project changes, and update `ios/README.md` with the real build steps.

## 6. Hosted web app

1. Ask me before deploying, because it makes the site public. Then run `npm run build && firebase deploy --only hosting`.
2. Make sure the hosted build does **not** contain the debug token: build with `VITE_APPCHECK_DEBUG_TOKEN` empty and grep `dist/web` to be sure.
3. Check the hosted site in a clean Chrome profile. A judge without the on-device model should see a clear setup message, not a broken page.
4. Put the URL in the README.

## 7. Submission text, numbers and demo prep

1. `docs/submission.md` has the Devpost text and the demo script, with `[[...]]` placeholders. Fill every placeholder with real numbers and real behaviour from steps 4 and 5. Use only real results. If a round failed, say so.
2. Check the text covers what the rules ask for: how Firebase AI Logic is used, the features, and the value proposition. Keep "Built with" accurate.
3. The rules say the project must be new during the submission period (from Nov 11, 1:30 PM PT) or significantly updated after it started. The repo's first commits are from earlier that same day. Everything you do now is the significant update. Make sure the text says honestly what was built and when, and show me that paragraph.
4. Demo prep, for my recording. The video must be public on YouTube, 3 minutes or less, in English. Get ready:
   - models already downloaded
   - one cantrip compiled in advance as a backup
   - the job-board tab open
   - the extension pinned
   - the iPhone ready with the share code
   - a clean Chrome profile with no personal tabs or bookmarks showing

   Then walk me through the script in `docs/submission.md` while I record with QuickTime. If a real job board is unreliable, make a local demo page with realistic sample job posts and say so in the README.
5. Add a short "Try it" section at the top of the README: the hosted URL, the video link (once I give it), what judges need (Chrome version and flags, an iPhone with Apple Intelligence), and how to run it from source.

## 8. Wrap up

1. Commit on branches and open PRs to `main`. Tell me what each PR contains. Merge only on my yes.
2. Then stop and give me a short list of what's left for me by hand, which should be:
   - record and upload the video
   - make the repo public (ask me first)
   - register for the hackathon on Devpost
   - fill the Devpost form from `docs/submission.md` (you can fill it in Chrome, but I press Submit)
   - revoke the App Check debug token after judging ends (Dec 16)
