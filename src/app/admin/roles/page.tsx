import { AdminShell } from "@/components/AdminShell";
import { RolesManager } from "@/components/manage/RolesManager";

export default function ManageRoles() {
  return (
    <AdminShell>
      <RolesManager />
    </AdminShell>
  );
}
