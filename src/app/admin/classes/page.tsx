import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { ClassesManager } from "@/components/manage/ClassesManager";

export default function ManageClasses() {
  return (
    <AdminShell>
      <SectionHead
        title="Classes"
        sub="Class schedules with a fixed time. These appear in the booking forms and auto-fill their time."
      />
      <div className="max-w-3xl">
        <ClassesManager />
      </div>
    </AdminShell>
  );
}
