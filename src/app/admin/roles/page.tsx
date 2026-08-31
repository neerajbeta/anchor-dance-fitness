import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { RolesManager } from "@/components/manage/RolesManager";

export default function ManageRoles() {
  return (
    <AdminShell>
      <SectionHead
        title="Roles & Permissions"
        sub="Define what each role can see and do across the admin panel."
      />
      <RolesManager />
    </AdminShell>
  );
}
