import { getRegistrations } from "@/lib/registrations";
import { RegistrationsClient } from "./RegistrationsClient";

// Server component: reads from PostgreSQL (Supabase) when configured,
// otherwise falls back to bundled sample data.
export const dynamic = "force-dynamic";

export default async function AllRegistrations() {
  const { rows, source } = await getRegistrations();
  return <RegistrationsClient rows={rows} source={source} />;
}
