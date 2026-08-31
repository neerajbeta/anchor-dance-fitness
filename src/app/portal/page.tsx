import { getUserSession } from "@/lib/auth/userActions";
import { listAnnouncements, DbNotConfiguredError } from "@/lib/services";
import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getUserSession();
  let announcements: Awaited<ReturnType<typeof listAnnouncements>> = [];
  try {
    announcements = await listAnnouncements();
  } catch (err) {
    if (!(err instanceof DbNotConfiguredError)) console.error("[portal] announcements query failed:", err);
  }
  return <PortalClient userName={session?.name ?? null} announcements={announcements} />;
}
