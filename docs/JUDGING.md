# Judging Cantrip the way #BuildHybridAI will

A mock judging pass, 23 November 2026, a week before the deadline (Mon 30 Nov, 2:00 PM PT).
It uses the contest's own rules. Then it scores the entry as three different judges would,
compares it with past winners of similar Google contests, and lists what was fixed and what
only Subomi can do.

## How the contest scores

Four criteria, **equally weighted**, each scored 1 to 5 and averaged (Rules §8). Ties are
broken in this order:

1. **Technological Implementation:** "How well is the project built, and how effectively does
   it use Firebase AI Logic hybrid inference as part of the solution?"
2. **Design:** "Does the project deliver a complete, coherent product experience, not just a
   technical proof of concept?"
3. **Potential Impact:** "Does the project make a credible, specific case for solving a real
   problem for a real audience, and does the solution address it based on what's demonstrated?"
4. **Quality of the Idea:** "Is this a creative, non-obvious use of Firebase AI Logic, and does
   the team show genuine understanding of the problem space?"

Other rules that matter here:

- **Stage one is pass or fail.** Cantrip passes. It has a public repo, a visible Apache 2.0
  licence, Firebase AI Logic imported and called in `src/firebase/ai.ts`, App Check, and a
  summary of what was built during the contest. The video is the one thing still missing.
- **Judges may score from the text, images and video alone.** The FAQ asks for who it's for,
  the problem and how Firebase AI Logic makes it work in the first 30 seconds, and to "show the
  hybrid features working early".
- **Judging may use automated AI-driven analysis.** So the README and the code must state the
  hybrid split plainly. They do.
- **Multi-platform entries get "strong consideration" for the Grand Prize**, but "an
  outstanding single-platform app can still win". Category prizes: Best Web/Chrome, Best iOS
  and Best Android, $3k each. One entry can win the Grand Prize plus one category.

## Scorecard

"Before" is the repo on `main` this morning, assuming a video made from the old script.
"After" is an estimate, in two steps: with this PR merged and deployed, and then with the video
shots listed at the end.

### Judge 1: Google DevRel, scoring strictly against the four criteria

| Criterion | Before | After PR | After PR + video | What moves it up |
|---|---|---|---|---|
| Technological Implementation | 4 | 4 | 5 | Both modes used on purpose: `ONLY_IN_CLOUD` compiles and `ONLY_ON_DEVICE` runs, with `responseConstraint`, `inferenceSource` shown on every verdict, and `initializeDeviceModel()`. App Check with reCAPTCHA Enterprise, Remote Config, anonymous Auth and Firestore. To reach 5, the video must show the extension reading a live page on Gemini Nano, with the Network tab empty. Nobody has seen that yet. |
| Design | 3 | 4 | 4 | Before: the hosted site is a dead end on any machine without Gemini Nano, and the extension path had never run in a browser. After: a labelled `?preview` walkthrough, plain-words errors, a **Try again** button, and the page side of the extension checked in Chromium. |
| Potential Impact | 3 | 4 | 4 | Before: "teach your browser a rule" names a mechanism, not a person. After: it opens on job seekers, with the FTC figure ($501M reported lost to job scams in 2024), and a "Who it's for" section. A 5 would need evidence of real users, which a one-week entry can't honestly show. |
| Quality of the Idea | 5 | 5 | 5 | The cloud model as a compiler and debugger for the on-device model is non-obvious. It is hybrid as a division of labour, not as a fallback. Holding out a third of the tests shows it understands how small models overfit. |
| **Average** | **3.75** | **4.25** | **4.5** | |

### Judge 2: product and UX

| Criterion | Before | After PR | After PR + video | What moves it up |
|---|---|---|---|---|
| Technological Implementation | 4 | 4 | 4 | The product works, and the meters make the cloud/device split visible. |
| Design | 3 | 4 | 4 | The web app is polished: live test dots, round cards, a "ran on this device · $0" line, and the program one click away. Weak spots before this PR: the dead end without Nano, raw SDK errors such as `appCheck/throttled`, no retry after a failed compile, and two badges on one card hiding each other. All fixed. Still missing: real screenshots or a GIF in the README. |
| Potential Impact | 3 | 4 | 4 | The audience is now named. It would score higher still if the demo used a real-looking job board flow rather than a page labelled as made up. The made-up page is the right call because of the no-logos rule, so leave it. |
| Quality of the Idea | 4 | 4 | 5 | "Describe your own trap" is a fresh product idea. The video's cold open (badges already on the page) is what makes a product judge get it in 10 seconds. |
| **Average** | **3.5** | **4.0** | **4.25** | |

### Judge 3: technical, reading the code

| Criterion | Before | After PR | After PR + video | What moves it up |
|---|---|---|---|---|
| Technological Implementation | 4 | 4 | 5 | `src/core` is small, pure and tested (39 tests before, 53 after), and the important behaviours are tested: holdout isolation, best-so-far kept, the cloud dying mid-repair, fragment tests. The fallback model has a timeout. Gaps: there is no end-to-end run of the extension on Nano, and the web bundle is over 500 kB (a warning only). |
| Design | 3 | 4 | 4 | The extension content script was refactored into testable `marks.ts`. Its own badges can no longer leak into the text it reads. |
| Potential Impact | 3 | 3 | 4 | The numbers are real, small and honest: 4 rules, 105 runs on the device, the misses left in. More rules, or a second person compiling, would add weight. |
| Quality of the Idea | 4 | 4 | 4 | It is the same idea as Google's Automated Prompt Optimization, done live for end users. The README says so up front, which is the right move. |
| **Average** | **3.5** | **3.75** | **4.25** | |

**Panel average:** 3.58 before, about 4.0 after the PR, about 4.33 with the video shots.
The video is the single biggest lever, because judges may score from it alone.

## Checking the hosted site

Checked with headless Chromium through Playwright. Gemini Nano does not run headless.

| Check | Result |
|---|---|
| Loads | Yes, HTTP 200, about 5 s to load, no script errors. |
| Phone width (390 px) | No sideways scrolling. The layout holds. |
| Device status | Says "This browser has no on-device model" and explains what is needed. The compile button is disabled rather than quietly using the cloud. |
| Remote Config | Answers (200). |
| Firestore read (install by code) | Works. A missing code says "No cantrip has that code." |
| App Check | 403 from the reCAPTCHA Enterprise exchange in the headless browser, then the SDK refuses to try again for a day. Expected for an automated browser, but a judge App Check turns away would see a frozen compile. Now explained in words. |
| Cloud compile | **Could not be checked** from here, because App Check refuses a headless browser and compiling needs Nano anyway. |
| On-device runs | **Could not be checked.** There is no `LanguageModel` in headless Chromium, and Chrome for Testing reports Nano unavailable. |
| Extension, page side | Checked in Chromium with the unpacked extension and scripted verdicts: 8 blocks on `demo/jobs.html`, 5 on `demo/inbox.html`, and badges, highlights and clearing all work. One bug found and fixed: two badges overlapping. |
| Extension, side panel | Boots with the debug token and shows the device notice and the **Read this page** card. |

## What past winners had

Sources: the Chrome Built-in AI Challenge winners for
[2024](https://developer.chrome.com/blog/ai-challenge-winners) and
[2025](https://developer.chrome.com/blog/ai-challenge-winners-2025), and the
[Gemini API Developer Competition winners](https://developers.googleblog.com/en/announcing-the-winners-of-the-gemini-api-developer-competition/).

- **The pitch opens on a person, not a feature.** Mochi opens with someone struggling through
  an article. Trail's author kept losing signal on hikes. Gaze Link is for people with ALS.
- **The reason to run on-device comes from the user's situation.** Trail has no signal on the
  trail. AAC Board AI keeps private conversations on the device. Pet Shelter can't afford cloud
  APIs.
- **Hybrid winners spell out which work goes where.** Trail plans online, then runs fully
  offline on Nano. Mentelo published a 15-row table of what goes where.
- **Judges can try something right away.** For example trailplanner101.com, crookedtankard.com
  and viddyscribe.com.
- **The AI's limits are stated.** AAC Board AI dropped a feature that was wrong about 20% of
  the time and wrote it up. Crooked Tankard lets dice rolls, not the model, decide outcomes.
- **Numbers were rare, so a real measured one stands out.** Gaze Link: 30 testers, up to 85%
  fewer keystrokes.

### The five things Cantrip lacked or under-showed

1. **A person with a daily problem in the first seconds.** The old pitch led with the mechanism
   ("teach your browser a rule"). *Fixed in text:* it now leads with job seekers and the FTC
   figure. The video still has to do it on screen.
2. **A situational reason for on-device, shown rather than said.** "Private, free, offline"
   was a slogan. *Fixed in the script:* Wi-Fi off, the Network tab empty, Read again. Only the
   video can show it.
3. **Something a judge can try in one click.** The hosted app needs Gemini Nano (22 GB of free
   disk), so most judges' laptops would hit a wall. *Fixed in code:* a clearly labelled
   `?preview` walkthrough and a "How to test it" section. It needs a deploy.
4. **More than one proven platform.** The iPhone app builds but has never run on a phone, and
   there is no Android app. The Grand Prize favours multi-platform entries. *Only Subomi* can
   change this, by running the iPhone app with real numbers. Even a single honest port result
   would make Cantrip multi-platform and eligible for Best iOS.
5. **Visual proof in the repo.** There were no screenshots, GIF or diagram, and the real
   numbers were buried in `docs/real-runs.md`. *Fixed in part:* a Mermaid diagram, a results
   table and a hardware status table are now in the README. Real screenshots must come from a
   real run on Nano, so they are left to Subomi rather than faked.

## Strengths to keep

- The idea itself: the cloud compiles and the device runs, and that split is the product.
- The honesty. Held-out tests, misses left in, "Gemini Nano is not deterministic" written
  down, and no iPhone claim. Judges trust entries that state their limits.
- The meters and test dots make hybrid inference visible, which is what the Tech criterion
  asks for.
- The rules for which work goes where are explicit in code (`ONLY_IN_CLOUD` and
  `ONLY_ON_DEVICE`), so an automated review finds them.

## What this PR changed

- README: the problem and audience first, a "Try it" table with every way in, real results,
  a Mermaid architecture diagram, and a table of what has and hasn't run on real hardware.
- Devpost text: a sharper tagline, an opening on a person and the FTC figure, "Who it's for",
  and "How to test it".
- Demo script: opens cold on badges already on the page, covers who, problem and hybrid by
  0:30, and proves "private" with Wi-Fi off and an empty Network tab.
- Hosted app: a `?preview` simulated walkthrough linked from the no-Nano notice. It is labelled
  on every screen and keeps its own storage, so scripted programs never enter the real library.
  The notice now tells "this browser has no Nano" apart from "this computer can't run it".
- Errors: App Check refusals, throttling, quota, network drops, timeouts and off-label device
  answers are now explained in words, with the original message kept in brackets. A failed
  compile offers **Try again**.
- Extension: badges from several cantrips share one row, Cantrip's own badges are never read
  back into the model, and the drawing code moved to `src/extension/marks.ts` with tests.
- Tests: 39 before, 53 after.

## What only Subomi can do, in order of impact

1. **Record the video from the new script**, and above all its cold open: `demo/jobs.html`,
   press **Read this page**, badges land. Then, between 1:35 and 2:00, Wi-Fi off, the Network
   tab empty, Read again. Those two shots carry the Tech and Impact scores.
2. **Dry-run the extension on Gemini Nano first.** Its side panel has never read a live tab on
   Nano. If anything breaks, tell Claude the same day.
3. **Merge, then deploy the web app** so `?preview` and the new error messages are live
   (`docs/SUBMIT.md` step 3).
4. **Run the iPhone app once** with an honest port result (rounds, unseen-test score,
   `modelVersion`). This makes the entry multi-platform for the Grand Prize and eligible for
   Best iOS. If it doesn't happen, select Web only and keep the current wording.
5. **Take two or three real screenshots or a short GIF** from the recording session (the compile
   view and the badged job board), for the README and the Devpost gallery.
6. **Note Chrome's model version** from `chrome://on-device-internals` in the description. The
   contest talks about "Gemini Nano 4", so naming what actually ran shows understanding.
