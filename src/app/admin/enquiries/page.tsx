import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { EnquiriesClient } from "./EnquiriesClient";

export default function ManageEnquiries() {
  return (
    <AdminShell>
      <SectionHead
        title="Enquiries"
        sub="Leads from the 'Book a Demo' form — people who haven't booked a class yet"
      />
      <EnquiriesClient />
    </AdminShell>
  );
}
