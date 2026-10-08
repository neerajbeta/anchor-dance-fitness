import { Badge } from "@/components/theme/Card";
import { LinkButton } from "@/components/theme/LinkButton";
import type { LastBooking } from "@/lib/bookingDraft";
import { formatVatRate } from "@/lib/vat";

/** Receipt card shown on /confirmation. */
export function BookingReceipt({ booking, method }: { booking: LastBooking; method?: "stripe" | "swish" | null }) {
  // Discount is measured before any VAT added on top.
  const discounted = booking.vatMode === "exclusive" ? booking.netAmount ?? booking.amount : booking.amount;
  const savings = Math.max(0, booking.baseAmount - discounted);
  return (
    <>
      <div className="my-5 rounded-[18px] border border-hairline bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-copy-dim">
          Receipt · #{booking.id}
        </div>
        <Row k="Student" v={booking.name} />
        <Row k="Detail" v={booking.detail} />
        {booking.category && <Row k="Category" v={booking.category} />}
        <Row k="Period" v={booking.period} />
        <Row k="Location" v={booking.location} />
        <Row k="Plan" v={booking.plan} />
        {booking.mode && (
          <div className="flex justify-between border-b border-hairline py-1.5 text-[13px]">
            <span className="text-copy-dim">Mode</span>
            <Badge tone="info">{booking.mode === "online" ? "💻 Online" : "🏃 In-Person"}</Badge>
          </div>
        )}
        {method && <Row k="Paid with" v={method === "swish" ? "Swish" : "Card (Stripe)"} />}
        {booking.discountCode && (
          <div className="flex justify-between border-b border-hairline py-1.5 text-[13px] text-ok">
            <span>Discount ({booking.discountCode})</span>
            <span>− SEK {savings.toLocaleString()}</span>
          </div>
        )}
        {booking.vatMode && booking.vatAmount ? (
          <Row
            k={`${booking.vatMode === "exclusive" ? "VAT" : "Includes VAT"} (${formatVatRate(booking.vatRateBp ?? 0)})`}
            v={`${booking.vatMode === "exclusive" ? "+ " : ""}SEK ${booking.vatAmount.toLocaleString()}`}
          />
        ) : null}
        <div className="flex justify-between py-1.5 text-sm font-bold text-copy">
          <span>Amount Paid</span>
          <span className="text-ok">✓ SEK {booking.amount.toLocaleString()}</span>
        </div>
      </div>

      <div className="mb-4 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a] dark:text-sky-200">
        {booking.mode === "online" ? (
          <>
            💻 <strong>Online:</strong> A Zoom link will be sent to {booking.email} before each
            session. Batch assignment will be shared within 24 hours.
          </>
        ) : (
          <>
            🏃 <strong>In-person:</strong> Studio address and timing details will be emailed to{" "}
            {booking.email}.
          </>
        )}
      </div>

      <div className="flex justify-center">
        <LinkButton href="/portal">Go to My Portal →</LinkButton>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-hairline py-1.5 text-[13px]">
      <span className="text-copy-dim">{k}</span>
      <span className="font-medium text-copy">{v}</span>
    </div>
  );
}
