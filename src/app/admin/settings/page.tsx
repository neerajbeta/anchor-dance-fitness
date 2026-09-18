import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { SettingsManager } from "@/components/manage/SettingsManager";
import { SwishCertificateCard } from "@/components/manage/SwishCertificateCard";

export default function PortalSettings() {
  return (
    <AdminShell>
      <SectionHead
        title="Portal Settings"
        sub="Portal-wide values used across student booking pages and admin booking tools."
      />
      <div className="flex max-w-2xl flex-col gap-4">
        <SettingsManager />
        <SwishCertificateCard />
      </div>
    </AdminShell>
  );
}
