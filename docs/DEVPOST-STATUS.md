# Devpost draft status

Checked 23 Nov 2026. The project is a **draft** on #BuildHybridAI 2026. Nothing has been submitted.

- Draft (edit): https://devpost.com/submit-to/31808-buildhybridai-2026/manage/submissions/1317951-cantrip/project-overview
- Submit step: https://devpost.com/submit-to/31808-buildhybridai-2026/manage/submissions/1317951-cantrip/finalization
- Preview: https://devpost.com/software/cantrip

Deadline: Mon 30 Nov 2026, 2:00 PM PT (11:00 PM Lagos).

## Filled

**Project overview**
- Name: Cantrip
- Elevator pitch: the tagline from `docs/submission.md`
- Thumbnail: `docs/gallery/1-cantrip-hybrid-split.png`

**Project details**
- About the project: `docs/submission.md` from "Inspiration" to "What's next", plus "How to test it", pasted unchanged (Markdown). Not pasted: the Built with line (it has its own field), the Links list (the Try it out links and video field cover it) and the demo script.
- Built with (15 tags, Devpost lowercases them): Firebase AI Logic, Gemini, Gemini Nano, Firebase App Check, Firebase Authentication, Cloud Firestore, Remote Config, Firebase Hosting, TypeScript, Vite, lit-html, Chrome Extensions (MV3), Apple Foundation Models, Swift, SwiftUI. The last three match the doc's Built with line; the doc's note that the iPhone app has never run on a phone is in the About text, since tags can't carry it. Remove those three if you'd rather not list them.
- Try it out links: https://sixth-trainer-388221.web.app and https://github.com/ubmids/cantrip
- Image gallery, in this order, each with a caption:
  1. `1-cantrip-hybrid-split.png`: the cloud compiles, the device runs
  2. `2-preview-compile-repairing.png`: `?preview`, caption starts "Simulated walkthrough"
  3. `3-preview-compile-results.png`: `?preview`, caption starts "Simulated walkthrough"
  4. `4-preview-verdict-highlight.png`: `?preview`, caption starts "Simulated walkthrough"
  5. `5-real-runs-on-gemini-nano.png`: the real-run table from the README, 14 Nov
- Demo video URL: **empty** (required before Submit).

**Additional info (for judges)**
- Submitter type: Individual (you are the only team member)
- Start date: 11-11-26 (repo created 11 Nov 2026)
- New or existing: "New. This project did not exist before Nov 11, 2026" (it was created on 11 Nov). The explanation box carries the "What was built when" paragraph anyway, including the two commits pushed about 5.5 hours before the period opened. **Check you are happy with "New"**: the alternative is "Existing" with the same paragraph.
- Platforms: Web (Chrome) only
- Main technology requirement: the Firebase AI Logic split (ONLY_IN_CLOUD compiler, ONLY_ON_DEVICE runtime, `inferenceSource` on every verdict, 105 of 105 test runs on the device), Web (Chrome) only, iPhone app never run on a phone. All from `docs/submission.md`.
- Demo URL: https://sixth-trainer-388221.web.app
- Testing instructions: the "How to test it" list (without the video line), plus "No credentials are needed."
- Licence URL: https://github.com/ubmids/cantrip/blob/main/LICENSE (GitHub detects Apache 2.0)

## Changed on 24 Nov: paste these into the draft

The hosted app now opens on a Job-scam shield and five sample job posts, and browsers without Gemini Nano can run it for real, in the cloud, through Firebase AI Logic's hybrid mode. Four parts of the draft are now out of date. Nothing on Devpost was touched.

1. **Project details > About the project:** paste `docs/submission.md` again, from "Inspiration" to "What's next", plus "How to test it", the same way as before. What changed: a new paragraph in "What it does" (the shield and the cloud fallback), a "Hybrid fallback, kept narrow" bullet and a longer Remote Config line in "How we built it", and a rewritten "How to test it".
2. **Additional info > Testing instructions:** replace with this:

   > - **One click, any computer:** open https://sixth-trainer-388221.web.app and press **Check these 5 posts**. The Job-scam shield checks five sample job posts. Without Gemini Nano the checks run on Gemini in the cloud through Firebase AI Logic's hybrid mode, and each result says so (15 per browser session). **Paste your own post** checks any text.
   > - **The full loop, with Gemini Nano:** desktop Chrome 148 or later (about 22 GB of free disk space, and 16 GB of memory or a GPU with more than 4 GB of VRAM). Press **Download the model** once, pick **Commission-only jobs** under "Your own rule", press **Compile**, then **Try it** on the examples. A compile takes about 1 to 3 minutes, and every check then runs on your device.
   > - **See a compile without Gemini Nano:** https://sixth-trainer-388221.web.app/?preview is the compile interface with scripted answers. It says so on every screen, and no model runs in it.
   > - **Code without any keys:** `npm install && npm test` runs the compiler loop, the page splitter and the page badges against fake models.
   >
   > No credentials are needed.

3. **Additional info > Main technology requirement:** add this sentence to the end of what is there:

   > Ready programs can also run with `InferenceMode.PREFER_ON_DEVICE`: Gemini Nano when Chrome has it, and `gemini-3.5-flash-lite` in the cloud when it doesn't. That is only for text the person picks or pastes in the web app, it is announced before the run, capped at 15 per browser session, and every verdict shows `inferenceSource`. Compiling and the extension's page reading stay `ONLY_ON_DEVICE`.

4. **Image gallery (optional, recommended):** add `docs/gallery/6-hosted-job-board-cloud-fallback.png` as the second image, captioned: "The hosted app on a computer without Gemini Nano: the Job-scam shield checked five sample posts in the cloud through Firebase AI Logic's hybrid mode, and every result says so. A real run, 24 Nov." It is a real screenshot of the hosted site, not the simulated walkthrough. Consider using it as the thumbnail, because it shows a person's problem rather than a diagram.

## Left for you

1. **Country of residence** (Additional info). Not in the docs, so left blank. Check it is an eligible country under the rules.
2. **Organization name** (Additional info, marked required "if applicable"). Left blank; put "N/A" or leave it if Devpost accepts that for an individual.
3. **The three attestation checkboxes** on Additional info (age of majority, eligible jurisdiction, not a sponsor employee). Not ticked.
4. **Record the video**, make it public on YouTube, and paste the link into Project details, Demo video URL. Also add it to the README "Try it" table (Video row) and push. The About text's "How to test it" says "the video shows the full loop on real hardware", which is only true once it is up.
5. **Terms checkbox and the Submit project button** on the Submit step. Not touched.

## Not done

- The Chrome extension badges are not in the gallery. They need Gemini Nano running and the extension loaded by hand, and the shell's headless Chrome has neither, so a real capture wasn't possible. If you get a good frame while recording the video, add it as a sixth image.
- The real hosted app (without `?preview`) isn't in the gallery: in headless Chrome it only shows "This browser has no on-device model".
