import { getEvents } from "@/lib/events";
import { getUserSession } from "@/lib/auth/userActions";
import { WorkshopsClient } from "./WorkshopsClient";

export const dynamic = "force-dynamic";

export default async function WorkshopsPage() {
  const [{ upcoming, past, source }, session] = await Promise.all([getEvents(), getUserSession()]);
  return (
    <WorkshopsClient upcoming={upcoming} past={past} source={source} userName={session?.name ?? null} />
  );
}
