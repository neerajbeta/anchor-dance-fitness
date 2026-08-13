import { getRecentClassBookings } from "@/lib/stats";
import { BookOnBehalfClient } from "./BookOnBehalfClient";

export const dynamic = "force-dynamic";

export default async function BookOnBehalf() {
  const { rows, connected } = await getRecentClassBookings();
  return <BookOnBehalfClient rows={rows} connected={connected} />;
}
