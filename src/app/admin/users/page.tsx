import { AdminShell } from "@/components/AdminShell";
import { UsersManager } from "@/components/manage/UsersManager";

export default function ManageUsers() {
  return (
    <AdminShell>
      <UsersManager />
    </AdminShell>
  );
}
