# Cantrip

**Teach your browser a rule. Gemini compiles it in the cloud. Your device runs it, for free, on every page.**

You type a rule in plain English: *"Warn me when a job post is really commission-only."*
Gemini in the cloud writes a tiny program for the model on your device, writes tests for it,
runs those tests **on your device**, reads what failed, rewrites the program, and repeats.
When it passes, the program runs on Gemini Nano on every page you read: no cloud call,
no cost, works offline, and the text never leaves your machine.

Built for [#BuildHybridAI](https://firebasehybridaihackathon.devpost.com/) with Firebase AI Logic.

## Why this is hybrid, and why it has to be

Most hybrid apps use the cloud as a fallback for when the device can't cope. Cantrip
splits the work by what each side is best at:

| | Cloud (Gemini, `ONLY_IN_CLOUD`) | Device (Gemini Nano, `ONLY_ON_DEVICE`) |
|---|---|---|
| Job | Compiler: designs, tests and repairs programs | Runtime: runs the program on everything you read |
| How often | A few calls, once per rule | Thousands of times, forever |
| Sees | Your rule and synthetic test texts | Your pages, emails and posts |
| Cost | A few calls | $0 |

The cloud never sees what you read, and the device never has to be smart enough to write
its own instructions. Small models are fragile about prompting; a big model that can watch
the small one fail, on the real hardware, can fix that. Google's own
[Automated Prompt Optimization](https://developer.android.com/blog/posts/how-automated-prompt-optimization-unlocks-quality-gains-for-ml-kit-s-gen-ai-prompt-api)
shows the idea works offline for developers. Cantrip does it live, for anyone, from one sentence.

## How the compiler works

```
your rule ──► ☁ design: labels, system prompt, 3 examples, 12 tests
                  │
                  ▼
            split tests: 2/3 tune · 1/3 holdout (never shown to the repair step)
                  │
          ┌──────►▼
          │   ▣ run every tune test on Gemini Nano
          │       │ all pass? ──────────────► ▣ run holdout tests once, report honestly
          │       ▼ no
          └── ☁ repair: read the failures, rewrite the program (best-so-far is kept)
```

- **Honest accuracy.** A third of the tests are held out from the repair loop, so the
  "unseen tests" score is earned. Examples that copy a test are dropped for the same reason.
- **Never goes backwards.** Repairs start from the best program so far, and the best one wins.
- **Learns from you.** Mark a verdict wrong and it becomes a test; Cantrip recompiles on your device.
- **Fails closed.** Programs run with `ONLY_ON_DEVICE`, so page text is never silently sent to the cloud.
- **Every verdict says where it ran** (`response.inferenceSource`), and the program Gemini
  wrote is one click away.
- **Share a rule.** Publish a cantrip to Firestore and install it elsewhere by code. On a
  device with a different model, Gemini ports the program and tunes it again there.

## Where Firebase AI Logic is called

- `src/firebase/ai.ts`: every model call. `getAI` + `GoogleAIBackend`, the cloud compiler with
  `InferenceMode.ONLY_IN_CLOUD` and a JSON `responseSchema`, the device runtime with
  `InferenceMode.ONLY_ON_DEVICE`, `onDeviceParams.promptOptions.responseConstraint`, and
  `initializeDeviceModel()` for the one-time download.
- `src/firebase/app.ts`: App Check (required by AI Logic) and Remote Config for the compiler
  model and round budget.
- `src/firebase/share.ts` and `firestore.rules`: sharing through Firestore with anonymous Auth.
- `src/core/`: the compiler loop, the runtime and page segmentation. Pure TypeScript, tested.

## Run it

You need an up-to-date desktop Chrome. Chrome's Prompt API, which Firebase AI Logic uses for
on-device inference, is on by default from Chrome 148 for web pages and Chrome 138 for
extensions. Chrome 157 needs no flag: `await LanguageModel.availability()` in DevTools answers
`downloadable` on a fresh profile. On Chrome 139 to 147, turn on
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` first.

Chrome downloads Gemini Nano once, the first time you press **Download the model**. For that
it needs about 22 GB of free disk space on the volume that holds your Chrome profile, and
either a GPU with more than 4 GB of VRAM or 16 GB of RAM with 4 CPU cores.
`chrome://on-device-internals` shows the model's status. On-device prompts are limited to
9,216 tokens.

1. Create a Firebase project. In the console open **AI Services > AI Logic**, choose the
   **Gemini Developer API**, and finish the guided setup.
2. Register a web app and copy its config into `.env` (start from `.env.example`).
3. App Check: Firebase AI Logic refuses calls without it (enforced for every project since
   2 November 2026). For the hosted web app register **reCAPTCHA Enterprise** and set
   `VITE_RECAPTCHA_ENTERPRISE_KEY`. For local dev and the extension, create a debug token
   under **App Check > Apps > Manage debug tokens** and set `VITE_APPCHECK_DEBUG_TOKEN`.
   Never build the hosted site with the debug token set, and never commit it.
4. Turn on **Authentication > Anonymous** and create a **Firestore** database, then deploy
   the rules: `firebase deploy --only firestore:rules`.
5. Optional: in **Remote Config** set `compiler_model` (default `gemini-3.8-flash`) and
   `max_rounds` (default 4).

```bash
npm install
npm test               # compiler, runtime and page segmentation tests
npm run dev            # web app at http://localhost:5173
npm run build:extension  # then load dist/extension at chrome://extensions (Developer mode)
npm run preview:simulated  # the interface with simulated models, for design work only
```

Deploy the web app with `npm run build && firebase deploy --only hosting`.

## The Chrome extension

Open the side panel from the toolbar. Compile a cantrip, switch it on, and press
**Read this page**: each post, card or message on the tab is checked on your device, and
flagged ones get a badge with the deciding words highlighted (CSS Custom Highlight API,
no DOM rewriting). Select any text and choose **Check with Cantrip** from the context menu.

## Limits

- Gemini Nano runs on desktop Chrome only. Without it, compiling is disabled rather than
  quietly running in the cloud.
- Inputs are clipped to 3,000 characters to stay inside the on-device token limit (9,216 tokens
  in Chrome, 4,096 on iPhone).
- Compiling needs network. Running does not.
- The extension uses an App Check debug token, because reCAPTCHA cannot load inside an
  extension page. That is fine for judging and not for a store release.

## License

Apache 2.0.
