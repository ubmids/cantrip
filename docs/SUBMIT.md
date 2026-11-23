# Submitting Cantrip to #BuildHybridAI

Deadline: **Mon 30 Nov 2026, 2:00 PM PT (11:00 PM Lagos)**. Aim for Sunday 29 Nov so nothing is rushed.

Devpost requires four things: a working demo app, a public repo, a demo video and a text description.

| Requirement | State |
|---|---|
| Working demo app | Done. Live at https://sixth-trainer-388221.web.app (web app; the Chrome extension is in `dist/extension`). |
| Text description | Done. `docs/submission.md`, web-only, real numbers only. Paste section by section into the Devpost form. |
| Public repo with a licence | Licence done (Apache 2.0). Repo is still **private**. |
| Demo video | Not recorded. Script is at the bottom of `docs/submission.md` (about 2 min 50 s). |

## What only you can do

1. **Join the hackathon** on Devpost: https://firebasehybridaihackathon.devpost.com (press "Join hackathon").
2. **Decide two things before the repo goes public:**
   - Four early commits are authored "Claude <noreply@anthropic.com>". Keep them as they are, or have them rewritten under your name. The submission text already says an AI coding assistant was used.
   - `docs/claude-code-prompt.md` (the build brief). Keep it public or remove it.
   Then make `ubmids/cantrip` public (GitHub, Settings, Danger Zone, Change visibility), or tell me "make it public" and I'll do it.
3. **Load the extension once** for the demo: `chrome://extensions`, Developer mode on, Load unpacked, pick `~/Desktop/cantrip/dist/extension`. Chrome doesn't let this be automated.
4. **Record the video** (3 minutes maximum; only the first 3 are judged). It must be in English, show the app working in Chrome, and be public on YouTube. Before recording, compile once so Gemini Nano is already downloaded. If a round fails on camera, keep it: the repair is the point.
5. **Submit on Devpost:** paste the text, add the hosted URL, the repo URL and the YouTube link, then press Submit.

## After submitting

- Don't push to the repo until judging ends (winners about 21 Dec).
- Revoke the App Check debug token after 16 Dec.

## Not in this submission

The iPhone app builds but has never been run on a phone, so the submission doesn't claim any iPhone result. If you run it before Sunday with real numbers, add them back to `docs/submission.md`; there's still a Best iOS prize ($3k).
