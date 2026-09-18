import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { EmailTemplatesManager } from "@/components/manage/EmailTemplatesManager";

export default function EmailTemplatesPage() {
  return (
    <AdminShell>
      <SectionHead
        title="Email Templates"
        sub="The emails students get automatically — welcome on signup and a confirmation for every booking."
      />
      <EmailTemplatesManager />
    </AdminShell>
  );
}
