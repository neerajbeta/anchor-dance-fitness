import { AdminShell } from "@/components/AdminShell";
import { PromotionsClient } from "./PromotionsClient";

export default function Promotions() {
  return (
    <AdminShell>
      <PromotionsClient />
    </AdminShell>
  );
}
