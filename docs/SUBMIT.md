# Submitting Cantrip to #BuildHybridAI

Deadline: **Mon 30 Nov 2026, 2:00 PM PT (11:00 PM Lagos)**. Aim for Sunday 29 Nov so nothing is rushed.

Devpost requires four things: a working demo app, a public repo, a demo video and a text description.

| Requirement | State |
|---|---|
| Working demo app | Done. Live at https://sixth-trainer-388221.web.app (web app; the Chrome extension is in `dist/extension`). |
| Text description | Done. `docs/submission.md`, web-only, real numbers only. Paste section by section into the Devpost form. |
| Public repo with a licence | Done. Apache 2.0, public at https://github.com/ubmids/cantrip |
| Demo video | Not recorded. Script is at the bottom of `docs/submission.md` (about 2 min 50 s), opening on the result. |

## What only you can do

1. **Join the hackathon** on Devpost: https://firebasehybridaihackathon.devpost.com (press "Join hackathon").
2. The repo is public (done 23 Nov).
3. **Deploy: done.** The hosted site was rebuilt with the debug token empty and deployed on 24 Nov 2026, with the Job-scam shield, the cloud fallback and `?preview`.
4. **Load the extension once** for the demo: `chrome://extensions`, Developer mode on, Load unpacked, pick `~/Desktop/cantrip/dist/extension`. Chrome doesn't let this be automated.
5. **Record the video** (3 minutes maximum; only the first 3 are judged). It must be in English, show the app working in Chrome, and be public on YouTube. Before recording, compile once so Gemini Nano is already downloaded. If a round fails on camera, keep it: the repair is the point.
6. **Put the YouTube link in two places:** the Devpost form and the README's "Try it" table (the Video row), then push before the deadline.
7. **Submit on Devpost:** choose the **Web (Chrome)** platform, paste the text including "How to test it", add the hosted URL, the repo URL and the YouTube link, then press Submit.

## Worth checking before judging (10 to 16 Dec)

- The hosted site runs on the Spark plan and the free Gemini tier. If several judges compile at once they may hit the free rate limit. The app now says so in words and the compiler falls back to the lighter model, but it is your call whether that is enough.
- Judges without Gemini Nano can now run the Job-scam shield in the cloud, 15 checks per browser session. To change the cap without a redeploy, add `cloud_checks_per_session` in Remote Config (0 turns the cloud fallback off); `cloud_check_model` changes the model.
- Firebase App Check turns away browsers that reCAPTCHA scores as automated, and the SDK then waits a day before trying again in that browser. A judge in a normal Chrome window should be fine.

## After submitting

- Don't push to the repo until judging ends (winners about 21 Dec).
- Revoke the App Check debug token after 16 Dec.

## Not in this submission

The iPhone app builds but has never been run on a phone, so the submission doesn't claim any iPhone result. If you run it before Sunday with real numbers, add them back to `docs/submission.md`; there's still a Best iOS prize ($3k).
