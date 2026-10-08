import { AdminShell } from "@/components/AdminShell";
import { RemindersClient } from "./RemindersClient";

export default function PaymentRemindersPage() {
  return (
    <AdminShell>
      <RemindersClient />
    </AdminShell>
  );
}
