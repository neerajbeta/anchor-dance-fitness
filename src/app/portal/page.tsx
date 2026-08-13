import { getUserSession } from "@/lib/auth/userActions";
import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getUserSession();
  return <PortalClient userName={session?.name ?? null} />;
}
