/**
 * The only places the studio can be hired. Separate from the class/event
 * Locations table on purpose — studio hire happens at these two venues only.
 * Safe to import on the client.
 */
export type StudioLocation = { label: string; country: string; flag: string };

export const STUDIO_LOCATIONS: StudioLocation[] = [
  { label: "Helenelund, Stockholm", country: "Sweden", flag: "🇸🇪" },
  { label: "Mumbai, India", country: "India", flag: "🇮🇳" },
];

export function isStudioLocation(label: unknown): boolean {
  return STUDIO_LOCATIONS.some((l) => l.label === label);
}

export function studioLocationFlag(label: string): string {
  return STUDIO_LOCATIONS.find((l) => l.label === label)?.flag ?? "";
}

export const STUDIO_LOCATION_ERROR = `Studio hire is only available at ${STUDIO_LOCATIONS.map((l) => l.label).join(" and ")}.`;
