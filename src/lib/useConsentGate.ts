"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_CONSENT, hasRequiredConsent, type ConsentChoices } from "@/lib/consent";

/**
 * GDPR consent, asked once per person — not once per form.
 *
 * Anyone who has already agreed to the current wording is never shown the block
 * again, on any booking screen. Someone who ticks it here has consented at that
 * moment, so for a signed-in student it is stored straight away rather than
 * waiting for the booking to complete: otherwise an abandoned or failed booking
 * loses the consent and the next form asks all over again.
 */
export function useConsentGate() {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [choices, setChoicesState] = useState<ConsentChoices>(EMPTY_CONSENT);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/my-consent", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        setSignedIn(Boolean(j.data));
        setNeedsConsent(!j.data?.consented);
      })
      // Signed-out bookings, or an unreachable check — ask for consent.
      .catch(() => live && setNeedsConsent(true));
    return () => {
      live = false;
    };
  }, []);

  const setChoices = useCallback(
    (next: ConsentChoices) => {
      setChoicesState(next);
      if (!signedIn || !hasRequiredConsent(next)) return;
      // Debounced: ticking the optional boxes one after another shouldn't send
      // a request per click. Each save replaces the whole set.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/api/my-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choices: next }),
        }).catch(() => {
          /* The booking itself records it too, so a failure here is not fatal. */
        });
      }, 700);
    },
    [signedIn],
  );

  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  return {
    /** True while this person still has to agree — false once they have. */
    needsConsent,
    choices,
    setChoices,
    /** False only while a required permission is still unticked. */
    ready: !needsConsent || hasRequiredConsent(choices),
  };
}
