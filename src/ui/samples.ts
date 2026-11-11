/** Starting points shown under the composer, each with texts to try it on. */
export interface Sample {
  intent: string;
  chip: string;
  tries: string[];
}

export const SAMPLES: Sample[] = [
  {
    chip: "Commission-only jobs",
    intent: "Warn me when a job post is really commission-only or unpaid, even if it hides it.",
    tries: [
      "Brand Ambassador (Remote). Join a fast-growing team and be your own boss! Uncapped earning potential, top performers make six figures. Compensation is performance-based on every client you sign. Flexible hours, no experience needed.",
      "Customer Success Associate. $52,000 to $58,000 base salary plus a quarterly bonus of up to 10%. Health, dental and a 401(k) match from day one. Hybrid, three days a week in our Austin office.",
      "Marketing Intern, Summer. Gain real-world experience with a top agency. This is an educational opportunity; interns receive a certificate and a strong reference. Must commit 30 hours a week.",
    ],
  },
  {
    chip: "Pressure-to-pay emails",
    intent: "Flag emails that pressure me to pay or act right now, especially ones pretending to be a company I use.",
    tries: [
      "Your account will be suspended in 24 hours. We were unable to process your last payment. To avoid losing access to your files, update your billing details immediately using the secure link below.",
      "Hi! Just a reminder that your invoice #2231 for October is due on the 30th. No action needed if you're on autopay. Thanks for being with us, the Fieldnotes team.",
      "Final notice: a parcel addressed to you is being held at our depot. A small redelivery fee of $1.99 is required today or it will be returned to sender.",
    ],
  },
  {
    chip: "Paid-for reviews",
    intent: "Tell me when a product review reads like it was paid for or written by the seller.",
    tries: [
      "BEST purchase EVER!!! This blender changed my life. Five stars. Highly recommend to everyone. Amazing quality, amazing price, amazing company. Buy it now you won't regret it!!!",
      "Solid for smoothies, struggles with ice unless you add liquid first. The lid seal started leaking after about four months, but customer service sent a replacement in a week.",
      "I received this product free in exchange for my honest review. Honestly it's great, works perfectly, love the color, and the brand is so responsive. 10/10.",
    ],
  },
  {
    chip: "Data-selling terms",
    intent: "Flag terms and privacy policies that let them sell or share my personal data with advertisers.",
    tries: [
      "We may share information about you with our advertising and marketing partners, who may combine it with other information to deliver personalised ads across other sites and services.",
      "We do not sell your personal information. We share data only with processors that help us run the service, under contracts that forbid them from using it for anything else.",
      "By using the app you grant us a perpetual, worldwide licence to use, license and commercialise usage data, including with third parties for their own purposes.",
    ],
  },
];
