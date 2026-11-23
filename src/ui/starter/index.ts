/**
 * The Job-scam shield: a cantrip that works on the first click.
 *
 * Its program, tests and scores are the real ones from compiling the
 * commission-only sample on Gemini Nano on 14 November 2026 (see
 * docs/real-runs.md), exported unchanged. Only the display name and the
 * one-line description are written for people looking for a job.
 */
import type { Cantrip } from "../../core/types";
import real from "./job-shield-14nov.json";

export const STARTER_ID = "starter-job-scam-shield";

export const STARTER_PROVENANCE =
  "Compiled and tested on Gemini Nano in Chrome 157 on 14 November 2026, on a MacBook with an M2 Pro: 9 of 9 tuning tests and 3 of 3 unseen tests, 1 cloud call, 12 runs on the device. It ships with the app, so it works on the first click.";

export function jobScamShield(now: number = Date.now()): Cantrip {
  const c = structuredClone(real.cantrip) as unknown as Cantrip;
  return {
    ...c,
    id: STARTER_ID,
    spec: {
      ...c.spec,
      name: "Job-scam shield",
      description: "Flags job posts that hide there is no guaranteed pay: commission-only or unpaid.",
    },
    provenance: STARTER_PROVENANCE,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export interface BoardPost {
  title: string;
  meta: string;
  body: string;
}

/** Five of the made-up listings from demo/jobs.html, word for word. */
export const BOARD_POSTS: BoardPost[] = [
  {
    title: "Brand Ambassador (Remote)",
    meta: "Zenith Reach · Anywhere · Flexible",
    body: "Join a fast-growing team and be your own boss! Uncapped earning potential, and our top performers make six figures. Compensation is performance-based on every client you sign. Flexible hours, no experience needed, full training provided once you purchase the starter kit.",
  },
  {
    title: "Customer Success Associate",
    meta: "Larkspur Software · Austin, TX · Hybrid",
    body: "Help small businesses get set up on our scheduling tool. $52,000 to $58,000 base salary plus a quarterly bonus of up to 10%. Health, dental and a 401(k) match from day one. Three days a week in our Austin office, with a paid onboarding month.",
  },
  {
    title: "Solar Sales Consultant",
    meta: "Sunline Home Energy · Phoenix, AZ · Field",
    body: "Meet homeowners and help them switch to solar. You keep 30% of every system you close, paid two weeks after install, with no cap on what you can earn. There is no base pay during the first six months. Leads are not provided, so bring your hustle and a reliable car.",
  },
  {
    title: "Account Executive, Mid-Market",
    meta: "Tallis Analytics · New York, NY · Hybrid",
    body: "Own a book of mid-market accounts and close new business. $85,000 base salary with on-target earnings of $170,000, where commission is paid on top of base from the first deal. Full benefits, 20 days of paid leave and equity. Quota relief during your three-month ramp.",
  },
  {
    title: "Junior Graphic Designer",
    meta: "Pallet & Pine Studio · Portland, OR · Remote",
    body: "We are a new studio looking for a designer to grow with us. The role is unpaid for the first three months while we find our feet, with great exposure and the chance of a paid position afterwards for the right person. Expect around 35 hours a week and tight deadlines.",
  },
];
