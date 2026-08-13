import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { LocationsManager } from "@/components/manage/LocationsManager";

export default function ManageLocations() {
  return (
    <AdminShell>
      <SectionHead
        title="Locations"
        sub="Studio cities available across the portal. Used in booking forms and filters."
      />
      <div className="max-w-2xl">
        <LocationsManager />
      </div>
    </AdminShell>
  );
}
