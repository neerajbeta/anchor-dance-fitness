import { getEvents } from "@/lib/events";
import { EventsClient } from "./EventsClient";

export const dynamic = "force-dynamic";

export default async function AdminEvents() {
  const { upcoming, past, source } = await getEvents();
  return <EventsClient events={[...upcoming, ...past]} source={source} />;
}
