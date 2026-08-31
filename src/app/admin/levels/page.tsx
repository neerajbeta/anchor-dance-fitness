import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { LevelsManager } from "@/components/manage/LevelsManager";

export default function ManageLevels() {
  return (
    <AdminShell>
      <SectionHead
        title="Levels"
        sub="Class skill levels (e.g. Beginner, Intermediate). Used when creating classes and in booking."
      />
      <div className="max-w-2xl">
        <LevelsManager />
      </div>
    </AdminShell>
  );
}
