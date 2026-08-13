import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { DiscountsManager } from "@/components/manage/DiscountsManager";

export default function ManageDiscounts() {
  return (
    <AdminShell>
      <SectionHead
        title="Discount Master"
        sub="Configurable discount codes. Apply to everything, a category, or a class — used at booking."
      />
      <div className="max-w-2xl">
        <DiscountsManager />
      </div>
    </AdminShell>
  );
}
