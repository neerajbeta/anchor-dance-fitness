"use client";

import { useEffect, useState } from "react";
import { DEFAULT_VAT_RULES, type VatRule } from "@/lib/vat";

let cache: Promise<VatRule[]> | null = null;

/** The VAT master rules, loaded once per page (null until loaded). */
export function useVatRules(): VatRule[] | null {
  const [rules, setRules] = useState<VatRule[] | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/vat")
      .then((r) => r.json())
      .then((j) => (j.data as VatRule[]) ?? DEFAULT_VAT_RULES)
      .catch(() => {
        cache = null; // try again next time
        return DEFAULT_VAT_RULES;
      });
    let live = true;
    cache.then((r) => live && setRules(r));
    return () => {
      live = false;
    };
  }, []);
  return rules;
}
