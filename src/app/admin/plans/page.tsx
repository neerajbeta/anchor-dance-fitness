import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { PlansManager } from "@/components/manage/PlansManager";

export default function ManagePlans() {
  return (
    <AdminShell>
      <SectionHead
        title="Plans"
        sub="Pricing plans shown on the student Choose Plan screen and in Book on Behalf."
      />
      <div className="max-w-3xl">
        <PlansManager />
      </div>
    </AdminShell>
  );
}
