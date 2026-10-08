/**
 * The GDPR consent students give when they sign up or book.
 *
 * Each permission is asked — and stored — separately, so it is always clear what
 * was agreed to: the contact & booking details we need to run their classes
 * (required), and then photos, videos and promotional use, each of which is
 * optional and can be withdrawn on its own in My Portal.
 *
 * Changing any wording: bump VERSION. Everyone is then asked again the next time
 * they book, and the admin can see who agreed to which version.
 * Safe to import on the client (no server code).
 */

export const CONSENT_VERSION = "2026-10-01";

export type ConsentKey = "data" | "photo" | "video" | "promo";

export type ConsentItem = {
  key: ConsentKey;
  /** Short heading on the checkbox. */
  title: string;
  /** The sentence the customer agrees to. */
  text: string;
  /** Worded for a parent agreeing on a child's / member's behalf. */
  memberText: string;
  /** Required ones must be ticked before signing up or booking. */
  required: boolean;
  /** Why we ask — shown under the checkbox. */
  hint: string;
};

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: "data",
    title: "Contact & booking details",
    text: "I consent to Anchor Dance & Fitness collecting and processing my contact and booking details for managing my classes and communicating with me, in accordance with GDPR.",
    memberText:
      "I consent to Anchor Dance & Fitness collecting and processing this member's contact and booking details for managing their classes and communicating with me, in accordance with GDPR.",
    required: true,
    hint: "Needed to register you, take bookings and send you class information and receipts.",
  },
  {
    key: "photo",
    title: "Photos",
    text: "I consent to Anchor Dance & Fitness taking and using dance photos of me or my child.",
    memberText: "I consent to Anchor Dance & Fitness taking and using dance photos of this member.",
    required: false,
    hint: "Optional — you can say no and still attend every class.",
  },
  {
    key: "video",
    title: "Videos",
    text: "I consent to Anchor Dance & Fitness recording and using dance videos of me or my child.",
    memberText: "I consent to Anchor Dance & Fitness recording and using dance videos of this member.",
    required: false,
    hint: "Optional — you can say no and still attend every class.",
  },
  {
    key: "promo",
    title: "Promotional use",
    text: "I consent to those photos and videos being used on our social media channels, website, advertisements and other marketing materials for promotional purposes.",
    memberText:
      "I consent to those photos and videos of this member being used on our social media channels, website, advertisements and other marketing materials for promotional purposes.",
    required: false,
    hint: "Optional — only applies to the photos or videos you allowed above.",
  },
];

/** The keys that have to be ticked before we can register or take a booking. */
export const REQUIRED_CONSENT_KEYS: ConsentKey[] = CONSENT_ITEMS.filter((i) => i.required).map((i) => i.key);

export type ConsentChoices = Record<ConsentKey, boolean>;

export const EMPTY_CONSENT: ConsentChoices = { data: false, photo: false, video: false, promo: false };

/** True once every required permission has been given. */
export function hasRequiredConsent(choices: Partial<ConsentChoices> | null | undefined) {
  return REQUIRED_CONSENT_KEYS.every((k) => Boolean(choices?.[k]));
}

/** Normalises whatever the browser sent into the four booleans we store. */
export function readConsentChoices(input: unknown): ConsentChoices {
  // Older clients (and the admin's own tools) may still send `consent: true`,
  // which means "agreed to everything as it was worded then".
  if (input === true) return { data: true, photo: true, video: true, promo: true };
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    data: Boolean(raw.data),
    photo: Boolean(raw.photo),
    video: Boolean(raw.video),
    promo: Boolean(raw.promo),
  };
}

/** One-line summary for the admin table and CSV, e.g. "Data, Photos". */
export function consentSummary(choices: Partial<ConsentChoices>) {
  const on = CONSENT_ITEMS.filter((i) => choices[i.key]).map((i) => i.title);
  return on.length ? on.join(", ") : "None";
}

export const CONSENT_TITLE = "Privacy & GDPR consent";

/** Shown under the checkboxes — the rights people have. */
export const CONSENT_NOTE =
  "Tick each permission you're happy to give. You can change the photo, video and promotional permissions at any time in My Portal, and ask us to correct or delete your data by emailing info@anchorsports.se. Your details are stored securely and never sold or shared for someone else's marketing.";

export const PRIVACY_EMAIL = "info@anchorsports.se";
