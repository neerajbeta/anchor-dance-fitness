import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { AnnouncementsManager } from "@/components/manage/AnnouncementsManager";

export default function ManageAnnouncements() {
  return (
    <AdminShell>
      <SectionHead
        title="Announcements"
        sub="Broadcast messages to every student — shown on their portal home."
      />
      <div className="max-w-2xl">
        <AnnouncementsManager />
      </div>
    </AdminShell>
  );
}
