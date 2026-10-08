import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { VatManager } from "@/components/manage/VatManager";
import { InvoiceSettingsCard } from "@/components/manage/InvoiceSettingsCard";

export default function VatPage() {
  return (
    <AdminShell>
      <SectionHead
        title="VAT Master"
        sub="VAT rate and inclusive / exclusive pricing for classes, workshops, events and studio hire."
      />
      <div className="max-w-5xl">
        <VatManager />
        <InvoiceSettingsCard />
      </div>
    </AdminShell>
  );
}
