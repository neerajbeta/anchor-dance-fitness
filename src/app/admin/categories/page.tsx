import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { CategoriesManager } from "@/components/manage/CategoriesManager";

export default function ManageCategories() {
  return (
    <AdminShell>
      <SectionHead
        title="Categories"
        sub="Class categories (e.g. Yoga, Zumba). Used when creating classes and in booking."
      />
      <div className="max-w-2xl">
        <CategoriesManager />
      </div>
    </AdminShell>
  );
}
