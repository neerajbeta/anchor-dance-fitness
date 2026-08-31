import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { BlockSlotsButton } from "@/components/BlockSlotsButton";
import { BookStudioOnBehalfButton } from "@/components/BookStudioOnBehalfButton";
import { getStudioBookings } from "@/lib/stats";
import { listStudioBlocks } from "@/lib/services";
import { AdminStudioClient } from "./AdminStudioClient";

export const dynamic = "force-dynamic";

export default async function AdminStudio() {
  const { connected, rows } = await getStudioBookings();

  let blocks: Awaited<ReturnType<typeof listStudioBlocks>> = [];
  try {
    blocks = await listStudioBlocks();
  } catch {
    blocks = [];
  }

  return (
    <AdminShell>
      <SectionHead
        title="Studio Bookings"
        sub="All studio hire — by location"
        right={
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <BookStudioOnBehalfButton />
            <BlockSlotsButton />
          </div>
        }
      />
      <AdminStudioClient rows={rows} blocks={blocks} />
    </AdminShell>
  );
}
