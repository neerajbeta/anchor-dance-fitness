import { getPaymentStats } from "@/lib/stats";
import { PaymentsClient } from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function AdminPayments() {
  const stats = await getPaymentStats();
  return <PaymentsClient stats={stats} />;
}
