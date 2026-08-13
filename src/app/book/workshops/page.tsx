import { getEvents } from "@/lib/events";
import { WorkshopsClient } from "./WorkshopsClient";

export const dynamic = "force-dynamic";

export default async function WorkshopsPage() {
  const { upcoming, past, source } = await getEvents();
  return <WorkshopsClient upcoming={upcoming} past={past} source={source} />;
}
