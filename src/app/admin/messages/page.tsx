import { AdminShell } from "@/components/AdminShell";
import { MessagesClient } from "./MessagesClient";

export default function BulkMessages() {
  return (
    <AdminShell>
      <MessagesClient />
    </AdminShell>
  );
}
