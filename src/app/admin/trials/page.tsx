import { AdminShell } from "@/components/AdminShell";
import { TrialsClient } from "./TrialsClient";

export default function TrialSessions() {
  return (
    <AdminShell>
      <TrialsClient />
    </AdminShell>
  );
}
