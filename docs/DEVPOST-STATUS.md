# Devpost draft status

Checked 23 Nov 2026, updated 24 Nov. The project is a **draft** on #BuildHybridAI 2026. Nothing has been submitted.

- Draft (edit): https://devpost.com/submit-to/31808-buildhybridai-2026/manage/submissions/1317951-cantrip/project-overview
- Submit step: https://devpost.com/submit-to/31808-buildhybridai-2026/manage/submissions/1317951-cantrip/finalization
- Preview: https://devpost.com/software/cantrip

Deadline: Mon 30 Nov 2026, 2:00 PM PT (11:00 PM Lagos).

## Filled

**Project overview**
- Name: Cantrip
- Elevator pitch: the tagline from `docs/submission.md`
- Thumbnail: `docs/gallery/thumbnail-hosted-job-board.png` (since 24 Nov; was image 1)

**Project details**
- About the project: `docs/submission.md` from "Inspiration" to "What's next", plus "How to test it", pasted unchanged (Markdown). Not pasted: the Built with line (it has its own field), the Links list (the Try it out links and video field cover it) and the demo script.
- Built with (15 tags, Devpost lowercases them): Firebase AI Logic, Gemini, Gemini Nano, Firebase App Check, Firebase Authentication, Cloud Firestore, Remote Config, Firebase Hosting, TypeScript, Vite, lit-html, Chrome Extensions (MV3), Apple Foundation Models, Swift, SwiftUI. The last three match the doc's Built with line; the doc's note that the iPhone app has never run on a phone is in the About text, since tags can't carry it. Remove those three if you'd rather not list them.
- Try it out links: https://sixth-trainer-388221.web.app and https://github.com/ubmids/cantrip
- Image gallery, in this order, each with a caption:
  1. `1-cantrip-hybrid-split.png`: the cloud compiles, the device runs
  2. `6-hosted-job-board-cloud-fallback.png`: the real hosted app in cloud fallback, 24 Nov
  3. `2-preview-compile-repairing.png`: `?preview`, caption starts "Simulated walkthrough"
  4. `3-preview-compile-results.png`: `?preview`, caption starts "Simulated walkthrough"
  5. `4-preview-verdict-highlight.png`: `?preview`, caption starts "Simulated walkthrough"
  6. `5-real-runs-on-gemini-nano.png`: the real-run table from the README, 14 Nov
- Demo video URL: **empty** (required before Submit).

**Additional info (for judges)**
- Submitter type: Individual (you are the only team member)
- Start date: 11-11-26 (repo created 11 Nov 2026)
- New or existing: "New. This project did not exist before Nov 11, 2026" (it was created on 11 Nov). The explanation box carries the "What was built when" paragraph anyway, including the two commits pushed about 5.5 hours before the period opened. **Check you are happy with "New"**: the alternative is "Existing" with the same paragraph.
- Platforms: Web (Chrome) only
- Main technology requirement: the Firebase AI Logic split (ONLY_IN_CLOUD compiler, ONLY_ON_DEVICE runtime, `inferenceSource` on every verdict, 105 of 105 test runs on the device), Web (Chrome) only, iPhone app never run on a phone. All from `docs/submission.md`.
- Demo URL: https://sixth-trainer-388221.web.app
- Testing instructions: the 24 Nov list (see below), plus "No credentials are needed."
- Licence URL: https://github.com/ubmids/cantrip/blob/main/LICENSE (GitHub detects Apache 2.0)

## Updated on 24 Nov (draft saved, still not submitted)

The hosted app now opens on a Job-scam shield (renamed the **Hidden-pay check** later on 24 Nov, see below), and browsers without Gemini Nano run it in the cloud through Firebase AI Logic's hybrid mode. The draft now matches main at 8049ce9:

1. **About the project:** re-pasted from `docs/submission.md` (Inspiration to What's next, plus How to test it), 10,029 characters, including the shield and cloud-fallback paragraph and the "Hybrid fallback, kept narrow" bullet.
2. **Testing instructions:** replaced with the new list (one click on any computer, the full loop with Gemini Nano, `?preview`, `npm test`), ending "No credentials are needed."
3. **Main technology requirement:** the `PREFER_ON_DEVICE` sentence is appended to the end.
4. **Gallery:** `6-hosted-job-board-cloud-fallback.png` is now image 2 of 6, captioned "Real run, 24 Nov: hosted app, no on-device model here, so Firebase AI Logic's hybrid mode ran the checks in the cloud. Each result says so." The suggested caption was 195 characters and Devpost allows 140, so this is a shorter version.
5. **Thumbnail:** now `thumbnail-hosted-job-board.png`, a 3:2 crop of the top of image 6 (headline, shield, first flagged post with "ran in the cloud"). It shows a person's problem, which reads better than the diagram. Image 1 is still first in the gallery.

Already on the draft from you (not touched by me): country of residence (Nigeria) and the three attestation checkboxes, all ticked.

## Renamed on 24 Nov: Job-scam shield is now the Hidden-pay check

The ready-made check only flags job posts that hide there is no guaranteed pay (commission-only or unpaid), so "Job-scam shield" promised more than it does. The app, the README and `docs/submission.md` now call it the **Hidden-pay check**, and the FTC $501M figure is given only as context, with a sentence saying the check catches one specific warning sign, not job scams in general. Not yet carried over:

- **About the project** on the Devpost draft still has the old text: re-paste `docs/submission.md` (Inspiration to What's next, plus How to test it).
- **Testing instructions** on the draft still say "Job-scam shield" if they were pasted with that name: change it to "Hidden-pay check".
- **The hosted site** still shows "Job-scam shield" until the next deploy (`VITE_APPCHECK_DEBUG_TOKEN= npm run build && firebase deploy --only hosting`).
- **Gallery image 6 and the thumbnail** (`6-hosted-job-board-cloud-fallback.png`, `thumbnail-hosted-job-board.png`) show the old name on screen. Recapture them after the deploy.

## Left for you

1. **Organization name** (Additional info). Devpost still marks Additional info "is required to submit", and this is the only empty required field there. Put "N/A" or your name as an individual.
2. **Record the video**, make it public on YouTube, and paste the link into Project details, Demo video URL (the other step still flagged). Also add it to the README "Try it" table (Video row) and push. The About text's "How to test it" says "the video shows the full loop on real hardware", which is only true once it is up.
3. **Terms checkbox and the Submit project button** on the Submit step. Not touched.
4. Optional: decide whether "New" is the right answer for new or existing (see above), and whether to keep the three iPhone tags in Built with.

## Not done

- The Chrome extension badges are not in the gallery. They need Gemini Nano running and the extension loaded by hand, and the shell's headless Chrome has neither, so a real capture wasn't possible. If you get a good frame while recording the video, add it as a sixth image.
- The real hosted app is in the gallery since 24 Nov (image 2), running in the cloud fallback.

## Update, 24 Nov 2026 (afternoon)

- Thumbnail: `docs/gallery/v2-1-front-page.png` (the redesigned front page).
- Image gallery replaced with five real-run images of the new design, in this order: `v2-2-stamped-on-device.png`,
  `v2-4-repairing-on-device.png`, `v2-5-compiled-9-of-9-unseen-3-of-3.png`, `v2-3-make-your-own-check.png`,
  `v2-1-front-page.png`, each captioned with what it shows and the date. The six old images (old design and the
  `?preview` walkthrough) were removed; their files are still in `docs/gallery/`.
- Built with: Apple Foundation Models, Swift and SwiftUI removed (the iPhone app never ran on a phone).
- About text and testing instructions re-pasted from `docs/submission.md` (Hidden-pay check wording).
- Additional info: "Existing", with line counts (7,638 lines before the period; +3,608 / -411 during it).
  Organization name: "N/A (individual entrant)".
- Still empty: the demo video URL (required). Devpost shows 3/5 steps done.

## SUBMITTED, 24 Nov 2026 (~14:00 UTC)

Video https://youtu.be/LlvJLOuaf3g (public, 1:43, channel "Strive AI" on the solagoke21 account). Devpost 5/5,
submitted; public page https://devpost.com/software/cantrip. Editable until 30 Nov 2026, 5:00 PM EST.
After the deadline: no pushes until judging ends (~21 Dec); revoke the App Check debug token after 16 Dec.
