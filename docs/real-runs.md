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

- On the scam cantrip, the parcel email verdict was corrected to "urgent scam". The correction became a test and the recompile started at once.
- The recompile scored 7/9, then 8/9 after one repair. The next cloud call then failed with a network error ("Failed to fetch") and the whole recompile was thrown away, although it already held a better program. That is a bug, fixed on this branch.

## Problems the real runs showed

1. Share did nothing visible when the clipboard stalled, and a second press published a second code. Fixed, with tests.
2. A cloud failure in the middle of the repair loop discarded the best program so far. Fixed, with a test.
3. Small things in the interface: "1 cloud calls", a "Try it" button that wrapped onto two lines, and a recompile round titled "Repair 0". Fixed.
