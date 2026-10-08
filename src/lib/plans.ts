// Shared plan rules — client-safe (no DB imports). Used by the student Choose Plan
// screen, admin Book on Behalf, the admin Plans screen and the /api/plans routes.

export type PlanInterval = "demo" | "monthly" | "quarterly" | "biannual" | "annual" | "onetime";

export type Plan = {
  id: string;
  code: string;
  name: string;
  interval: PlanInterval;
  price: number; // SEK — per month for recurring plans, flat for demo/one-time
  currency: string;
  description: string | null;
  active: boolean;
};

export type PlanInput = {
  name: string;
  interval: PlanInterval;
  price: number;
  description: string | null;
  active: boolean;
};

export const PLAN_INTERVALS: PlanInterval[] = ["demo", "monthly", "quarterly", "biannual", "annual", "onetime"];

/**
 * The trial (demo) plan — one class, charged once, at the plan's own price.
 * Its price is the trial price the whole app uses: the student's Choose Plan
 * screen, admin Book on Behalf and the Trial Sessions report all read it from
 * here, so it's changed in one place (Catalog → Plans).
 */
export function isTrialPlan(plan: Pick<Plan, "interval">) {
  return plan.interval === "demo";
}

/** The trial plan out of a list, or null when the studio doesn't offer one. */
export function trialPlanOf<P extends Pick<Plan, "interval">>(list: P[] | null | undefined): P | null {
  return list?.find(isTrialPlan) ?? null;
}

/** Months a plan covers. 0 = charged once (demo / one-time). */
export const INTERVAL_MONTHS: Record<PlanInterval, number> = {
  demo: 0,
  onetime: 0,
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

export const INTERVAL_LABELS: Record<PlanInterval, string> = {
  demo: "Demo / trial (charged once)",
  onetime: "One-time (charged once)",
  monthly: "Monthly (1 month)",
  quarterly: "Quarterly (3 months)",
  biannual: "Bi-annual (6 months)",
  annual: "Annual (12 months)",
};

/**
 * What the student pays for a plan. Recurring plans: monthly price × months, where the
 * monthly price is the class's own price for class bookings, else the plan's price.
 * Demo / one-time plans always charge the plan price once.
 */
/**
 * Length of a booking in months, counting any part month as a full one:
 * 17 Sep → 17 Oct = 1, 17 Sep → 25 Sep = 1, 17 Sep → 20 Dec = 4.
 * Takes ISO dates (YYYY-MM-DD); returns null when either is missing or invalid.
 */
export function monthsBetween(start?: string | null, end?: string | null): number | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const a = start?.match(re);
  const b = end?.match(re);
  if (!a || !b || end! < start!) return null;
  const [y1, m1, d1] = a.slice(1).map(Number);
  const [y2, m2, d2] = b.slice(1).map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1; // last month not complete yet…
  const leftover = d2 !== d1; // …and any remaining days start another month
  return Math.max(1, months + (leftover ? 1 : 0));
}

/**
 * Plans that fit inside a booking of `bookedMonths`: a 1-month booking can't
 * be sold a quarterly plan. With no booking length, every plan is offered.
 */
export function plansForMonths<P extends Pick<Plan, "interval">>(plans: P[], bookedMonths: number | null): P[] {
  if (!bookedMonths) return plans;
  const fitting = plans.filter((p) => INTERVAL_MONTHS[p.interval] <= bookedMonths);
  if (fitting.length > 0) return fitting;
  // Nothing short enough (e.g. no monthly plan exists) — offer the shortest one available.
  const shortest = Math.min(...plans.map((p) => INTERVAL_MONTHS[p.interval]));
  return plans.filter((p) => INTERVAL_MONTHS[p.interval] === shortest);
}

export function planTotal(plan: Pick<Plan, "interval" | "price">, classPrice?: number | null) {
  const months = INTERVAL_MONTHS[plan.interval];
  if (months === 0) return plan.price;
  const monthly = classPrice && classPrice > 0 ? classPrice : plan.price;
  return monthly * months;
}

/** Saving vs paying the Monthly plan's price every month (plan-only purchases). */
export function planSavings(plan: Pick<Plan, "interval" | "price">, monthlyPlan?: Pick<Plan, "price"> | null) {
  const months = INTERVAL_MONTHS[plan.interval];
  if (!monthlyPlan || months <= 1) return 0;
  return Math.max(0, (monthlyPlan.price - plan.price) * months);
}

/** Shortest commitment first, then cheapest. */
export function sortPlans<T extends Pick<Plan, "interval" | "price">>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => INTERVAL_MONTHS[a.interval] - INTERVAL_MONTHS[b.interval] || a.price - b.price
  );
}

/** Validates a create (partial=false) or update (partial=true) body. */
export function parsePlanInput(
  raw: unknown,
  partial: boolean
): { ok: true; value: Partial<PlanInput> } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<PlanInput> = {};

  if (b.name !== undefined || !partial) {
    const name = String(b.name ?? "").trim();
    if (!name) return { ok: false, error: "Plan name is required" };
    out.name = name;
  }
  if (b.interval !== undefined || !partial) {
    if (!PLAN_INTERVALS.includes(b.interval as PlanInterval)) {
      return { ok: false, error: "Choose a valid billing interval" };
    }
    out.interval = b.interval as PlanInterval;
  }
  if (b.price !== undefined || !partial) {
    const price = Number(b.price);
    if (b.price === "" || b.price === null || !Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Price must be a number of 0 or more" };
    }
    out.price = Math.round(price);
  }
  if (b.description !== undefined) out.description = String(b.description ?? "").trim() || null;
  if (b.active !== undefined) out.active = Boolean(b.active);

  return { ok: true, value: out };
}
