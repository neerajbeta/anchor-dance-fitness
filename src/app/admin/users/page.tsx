import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { UsersManager } from "@/components/manage/UsersManager";

export default function ManageUsers() {
  return (
    <AdminShell>
      <SectionHead
        title="User Management"
        sub="Create, edit, and manage admin-panel accounts — students are unaffected."
      />
      <UsersManager />
    </AdminShell>
  );
}
