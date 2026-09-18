// Stripe Checkout — server only.
//
// We use Stripe's hosted Checkout page, so card numbers are typed on Stripe's
// domain and never touch this app (no PCI surface here). Plain REST calls, so
// there's no SDK dependency to keep in sync.

export class StripeNotConfiguredError extends Error {
  constructor(message = "Stripe is not configured on this server") {
    super(message);
  }
}

export class StripeApiError extends Error {}

const API = "https://api.stripe.com/v1";

function secretKey() {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new StripeNotConfiguredError("STRIPE_SECRET_KEY is not set");
  return key;
}

export function isStripeConfigured() {
  return Boolean((process.env.STRIPE_SECRET_KEY ?? "").trim());
}

export const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY ?? "sek").toLowerCase();

/** Stripe's form encoding: nested objects become `a[b][c]=value`. */
function encode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (typeof value === "object") {
      out.push(...encode(value as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

async function stripeRequest<T>(path: string, method: "GET" | "POST", params?: Record<string, unknown>): Promise<T> {
  const body = method === "POST" ? encode(params ?? {}).join("&") : undefined;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) {
    throw new StripeApiError(json.error?.message || `Stripe request failed (${res.status})`);
  }
  return json as T;
}

export type StripeSession = {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  amount_total: number | null;
  metadata?: Record<string, string>;
};

export async function createCheckoutSession(input: {
  /** SEK, whole kronor — converted to öre for Stripe. */
  amount: number;
  description: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  registrationId: string;
}) {
  return stripeRequest<StripeSession>("/checkout/sessions", "POST", {
    mode: "payment",
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.registrationId,
    // Stripe's shortest allowed lifetime. Keeps an abandoned checkout from
    // being paid hours later, after the booking stopped holding its place.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 30,
    metadata: { registration_id: input.registrationId },
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": STRIPE_CURRENCY,
    "line_items[0][price_data][unit_amount]": Math.round(input.amount * 100),
    "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
  });
}

export async function retrieveCheckoutSession(id: string) {
  return stripeRequest<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}`, "GET");
}

/** Closes an unpaid Checkout page so it can't be paid later (e.g. via the browser's Back button). */
export async function expireCheckoutSession(id: string) {
  return stripeRequest<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}/expire`, "POST");
}
