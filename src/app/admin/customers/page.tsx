import { AdminShell } from "@/components/AdminShell";
import { CustomersClient } from "./CustomersClient";

export default function ManageCustomers() {
  return (
    <AdminShell>
      <CustomersClient />
    </AdminShell>
  );
}
