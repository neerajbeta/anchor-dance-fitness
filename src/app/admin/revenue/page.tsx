import { AdminShell } from "@/components/AdminShell";
import { RevenueClient } from "./RevenueClient";

export default function RevenueDashboard() {
  return (
    <AdminShell>
      <RevenueClient />
    </AdminShell>
  );
}
