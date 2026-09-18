"use client";

import { useEffect, useState } from "react";
import { STUDIO_LOCATIONS } from "@/lib/studioLocations";

type Loc = { id: string; label: string; country: string | null; flag: string | null };

/**
 * Location <select> that loads options from /api/locations (dynamic, admin-managed).
 * Works uncontrolled (pass `name`) or controlled (pass `value` + `onChange`).
 */
export function LocationSelect({
  name,
  className = "field",
  value,
  onChange,
  withCountry = false,
  allOption,
  required,
  studio = false,
}: {
  name?: string;
  className?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  withCountry?: boolean;
  allOption?: string;
  required?: boolean;
  /** Only the studio-hire venues (fixed list), instead of the Locations table. */
  studio?: boolean;
}) {
  const [locs, setLocs] = useState<Loc[]>([]);
  useEffect(() => {
    if (studio) {
      setLocs(STUDIO_LOCATIONS.map((l) => ({ id: l.label, label: l.label, country: null, flag: l.flag })));
      return;
    }
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocs(j.data ?? []));
  }, [studio]);

  const controlled = value !== undefined;

  return (
    <select
      name={name}
      className={className}
      required={required}
      {...(controlled ? { value, onChange } : { defaultValue: "" })}
    >
      {allOption ? (
        <option value="">{allOption}</option>
      ) : (
        !controlled && (
          <option value="" disabled>
            Select location
          </option>
        )
      )}
      {locs.map((l) => (
        <option key={l.id} value={l.label}>
          {l.flag} {l.label}
          {withCountry && l.country ? `, ${l.country}` : ""}
        </option>
      ))}
    </select>
  );
}
