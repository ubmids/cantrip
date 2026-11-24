# Real runs, 14 November 2026

Every number here came from a real run. Nothing is estimated.

- Machine: MacBook with Apple M2 Pro, 16 GB of memory, macOS 27.0.
- Browser: Chrome 157.0.8103.78, no flags turned on.
- On-device model: Gemini Nano through Firebase AI Logic (`InferenceMode.ONLY_ON_DEVICE`). Chrome downloaded it in about 28 minutes and it took about 4 GB of disk.
- Cloud compiler: `gemini-3.6-flash` through Firebase AI Logic, set in Remote Config.
- Firebase project: `sixth-trainer-388221`, Spark plan.
- Round budget: 4 (the default).

## The four samples, compiled at `localhost:5173`

Scores are tests passed out of tests run on the device. "Unseen" tests are held back from the repair loop.

| Sample | Name Gemini gave it | Rounds on the device | Unseen tests | Cloud calls | Device runs | Time |
|---|---|---|---|---|---|---|
| Commission-only jobs | Unpaid Job Detector | 8/9, then 9/9 | 3/3 | 2 | 21 | 85.1 s |
| Pressure-to-pay emails | Urgent Scam Email Detector | 5/8, 7/8, 7/8, then 8/8 | 3/4 | 4 | 36 | 166.9 s |
| Paid-for reviews | Paid Review Detector | 7/8, 7/8, 7/8, then 8/8 | 4/4 | 4 | 36 | 183.7 s |
| Data-selling terms | Ad Data Sharing Classifier | 9/9 on the first draft | 3/3 | 1 | 12 | 51.1 s |

Details:

- Every one of the 105 test runs reported `on_device` as its source. None errored.
- A single device run took about 1.9 seconds (median across each compile), and the slowest took 3.9 seconds.
- Commission-only jobs: the first draft called an equity-only role "commission only". Gemini's diagnosis: "The model confused equity-only pay with commission-only pay because both lack a guaranteed cash base salary." The repair fixed it.
- Pressure-to-pay emails: the one unseen test it missed was a normal email that it called an urgent scam. That miss is left in the score.
- Paid-for reviews: the stubborn failure was a genuine review that mentioned a free in-store sample. It took three repairs.
- Labels chosen by Gemini: "standard paid job, unpaid job, commission only", "urgent scam, suspicious alert, normal email", "genuine review, sponsored review, seller promo", "shares ad data, no ad sharing".

## Trying the compiled programs

All twelve example texts in the app (three per sample) were run with **Run on device**.

- All twelve verdicts carried the badge "ran on this device", taking 1.9 to 3.8 seconds each.
- Eleven of the twelve labels were the ones a person would expect. The twelfth, the parcel "redelivery fee" email, was flagged as "suspicious alert" where "urgent scam" fits better. It was still flagged.
- Ten of the twelve verdicts quoted the deciding words from the text.
- Network check: with the page's resource timing observed, running a program made no network request at all. Checked on `localhost` and on the hosted site. The only requests in the whole session were the compiler's cloud calls (nine for the three compiles watched) and one App Check refresh.

## The hosted site, https://sixth-trainer-388221.web.app

- Installed the commission-only cantrip by its share link (`?c=` code). It arrived with its scores and ran on the device straight away: flagged "commission only" in 3.8 seconds, no network request.
- Full compile on the hosted site, commission-only sample: 9/9 on the first draft, 3/3 unseen, 1 cloud call, 12 device runs, 55.8 seconds. App Check there is reCAPTCHA Enterprise, not a debug token.

## Learning from a correction

- On the scam cantrip, the parcel email verdict was corrected to "urgent scam". The correction became a test (13 tests, 1 from a correction) and the recompile started at once.
- First attempt: 7/9, then 8/9 after one repair. The next cloud call failed with a network error ("Failed to fetch") and the whole recompile was thrown away, although it already held a better program. That was a bug, now fixed.
- Second attempt, after the fix: the program it already had passed 9/9 including the corrected email, so no repair was needed. 0 cloud calls, 13 device runs, 27.2 seconds, 3/4 unseen.

## Gemini Nano is not deterministic

The same program and the same parcel email gave three different labels on three runs: "suspicious alert", "urgent scam" and "normal email". Chrome's Prompt API offers no sampling control to web pages in this version, so a borderline text can flip between runs. Scores above are single runs and can move by a test either way.

## Real job pages

The extension could not be loaded by automation (Chrome's extensions page needs a person), so this part was checked by running the page splitter on real pages and feeding real blocks to the compiled program in the web app.

- Splitting, sample pages in `demo/`: `demo/jobs.html` gave 8 blocks, one per job card. `demo/inbox.html` gave 5 blocks, one per email.
- Splitting, a public job board's listing page: 40 blocks (the cap). The cards there are 120 to 210 characters of title, company and tags, with no pay details, so a pay rule has little to judge on a listing page.
- Splitting, one public job post on the same board (4,605 characters): 15 blocks. The post is longer than a block may be, so it is read paragraph by paragraph, and the sidebar's other listings are read too.
- Running real paragraphs from that post through the commission-only program:
  - The paragraph that says the role is fully commission based was flagged "commission only". Correct.
  - A paragraph of duties with no word about pay was flagged "unpaid job". Wrong. This is a real weakness: the program was tested on whole posts and met a fragment.
- Fix: the compiler now tells Gemini that pages arrive one block at a time, that missing information is not a signal, and asks for at least two fragment tests.
- After the fix, recompiled (9/9 first draft, 3/3 unseen, 1 cloud call, 12 device runs, 45.2 seconds), each paragraph run twice:
  - commission paragraph: "commission only" both times. Correct.
  - duties paragraph: "standard pay" both times. Fixed.
  - a skills paragraph: "standard pay" both times. Correct.
  - a company blurb that says reps can "earn up to 90K": "commission only" both times. Debatable, since the blurb does not say how pay works.
- The first run after a page load took 21.5 seconds while Chrome loaded the model. Later runs took 2 to 4 seconds.

## Sharing

- Sharing from `localhost` published a code, and opening the hosted site with that code installed the cantrip there with its scores, ready to run.
- With the fix, a share shows its code even when the clipboard does not answer, and pressing Share again keeps the same code.
- Three test shares are in Firestore from these runs. One of them is an orphan from the stall bug.

## Problems the real runs showed

1. Share did nothing visible when the clipboard stalled, and a second press published a second code. Fixed, with tests.
2. A cloud failure in the middle of the repair loop discarded the best program so far. Fixed, with a test.
3. Programs flagged page fragments that carried no information. The compiler now asks for fragment tests. Fixed for the case seen, with a test on the prompt.
4. Small things in the interface: "1 cloud calls", a "Try it" button that wrapped onto two lines, and a recompile round titled "Repair 0". Fixed.

## Not run yet

- The Chrome extension itself, in a real browser: side panel, Read this page, badges and highlights, the right-click check, install by code. (The page side was checked on 23 November, below.)
- The iPhone app on a phone.

# Checks, 23 November 2026

## The extension's page side, in a real browser

Chromium (Chrome for Testing 145, headless, driven by Playwright) loaded the unpacked
extension from `dist/extension`. Chrome for Testing has no Gemini Nano, so the verdicts were
scripted and sent to the page the same way the side panel sends them. What this checks is
everything on the page side: splitting, badges, highlights and clearing.

- `demo/jobs.html` gave 8 blocks, one per job card. `demo/inbox.html` gave 5 blocks, one per
  email. Same as the splitter gave on 14 November.
- Flagged cards got the red outline and a badge reading "commission only, on device", and the
  quoted words were highlighted with the CSS Custom Highlight API. All three quotes were found
  in the page text.
- Bug found: when two cantrips flagged the same card, the second badge sat on top of the first
  and hid it. Fixed: badges now share one row. Checked again in the same browser, with tests.
- A second **Read this page** removed every badge before reading again.
- The side panel page booted with the debug token, showed the device notice ("Chrome offers
  Gemini Nano here but says it can't run on this computer") and the **Read this page** card.

## The hosted site, from a headless browser

- https://sixth-trainer-388221.web.app loaded in about 5 seconds, with no script errors. At
  390 px wide there is no sideways scrolling.
- Remote Config answered. Installing by a code that does not exist said "No cantrip has that
  code.", so the Firestore read path works.
- App Check refused the headless browser (HTTP 403 from the reCAPTCHA Enterprise exchange),
  and the Firebase SDK then waits a day before trying again in that browser. That is expected
  for an automated browser. It means compiling could not be checked from here, and that any
  visitor App Check turns away gets the same wait. The app now explains this in words instead
  of showing the SDK's error code.
- The headless browser has no `LanguageModel`, so the device side could not be checked here.

## Not run yet

- The extension's side panel reading a live tab with Gemini Nano.
- The iPhone app on a phone.

# Checks, 24 November 2026: the cloud fallback

The web app now runs a ready cantrip in the cloud when the browser has no Gemini Nano, using
Firebase AI Logic's `InferenceMode.PREFER_ON_DEVICE` with `gemini-3.5-flash-lite` as the cloud
model. Compiling and the extension's page reading still use `ONLY_ON_DEVICE` only.

## The Hidden-pay check (first shipped as the Job-scam shield)

The shield that the app now ships is the commission-only program from the second compile
above (after the fragment fix: 9/9 on the first draft, 3/3 unseen, 1 cloud call, 12 device
runs). It was exported unchanged from the browser storage of that run, and it matches the copy
published to Firestore on 14 November. Only its display name and one-line description are new.

## On localhost, against the real Firebase project

Headless Chromium (Chrome for Testing 145, driven by Playwright) has no `LanguageModel`, so it
stands in for a judge's computer without Gemini Nano. App Check used the debug token.

- The page said, before anything ran, that the posts would go to Gemini in the cloud, with
  15 checks left in the session.
- **Check these 5 posts** made five `generateContent` calls to `gemini-3.5-flash-lite`, all
  HTTP 200. Every result was labelled "ran in the cloud: no on-device model here".
- Labels: Brand Ambassador "commission only", Customer Success Associate "standard pay", Solar
  Sales Consultant "commission only", Account Executive "standard pay" (base plus commission),
  Junior Graphic Designer "unpaid job". Four of the five quoted words found in the post, which
  the app highlighted. The Solar Sales Consultant quote did not match the post, so nothing was
  highlighted there.
- Each check took 1.2 to 8.3 seconds. The whole board took about 21 seconds.
- **Paste your own post** with the first example: "commission only", 2.9 seconds, labelled as a
  cloud run. The correction buttons are replaced by a line saying corrections need Gemini Nano,
  because a correction recompiles on the device.
- The session count went down by one per check, and at 390 px wide nothing scrolled sideways.

## On the hosted site, after the deploy

- Headless Chromium: App Check refused the reCAPTCHA Enterprise exchange (HTTP 403), as on
  23 November. The board now stops after the first refused check, shows one plain-words error
  with **Try again**, and spends one cloud check, not five. Nothing scrolled sideways at 390 px
  or at 1280 px, and `?preview` still loaded at 390 px.
- Desktop Google Chrome 158 with a fresh profile (no Gemini Nano downloaded), started by
  Playwright as a normal window: the reCAPTCHA Enterprise exchange answered 200, and **Check
  these 5 posts** made five `generateContent` calls to `gemini-3.5-flash-lite`, all 200, 1.2 to
  1.8 seconds each. Same five labels as on localhost, each marked "ran in the cloud: no
  on-device model here". So App Check and Firebase AI Logic work on the hosted domain for a
  normal Chrome window.

These are runs of Gemini in the cloud, not Gemini Nano, so none of them count toward the
on-device results above.

