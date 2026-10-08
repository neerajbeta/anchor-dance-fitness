import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth/userActions";
import { listAnnouncements, getStudentPortalData, DbNotConfiguredError } from "@/lib/services";
import { PortalClient, type PortalBooking, type PortalProfile } from "./PortalClient";

export const dynamic = "force-dynamic";

function logUnlessNoDb(label: string, reason: unknown) {
  if (!(reason instanceof DbNotConfiguredError)) console.error(`[portal] ${label} query failed:`, reason);
}

export default async function PortalPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [announcementsResult, dataResult] = await Promise.allSettled([
    listAnnouncements(),
    getStudentPortalData(session.email),
  ]);

  const fmtDay = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  // Only plain values cross into the client component; dates are formatted here.
  const announcements =
    announcementsResult.status === "fulfilled"
      ? announcementsResult.value.map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          tone: a.tone,
          postedOn: fmtDay(a.createdAt),
          until: fmtDay(a.expiresAt),
        }))
      : [];
  if (announcementsResult.status === "rejected") logUnlessNoDb("announcements", announcementsResult.reason);

  let profile: PortalProfile = null;
  let bookings: PortalBooking[] = [];
  if (dataResult.status === "fulfilled") {
    const { profile: p, registrations } = dataResult.value;
    profile = p
      ? { name: p.name, email: p.email, city: p.city, country: p.country, location: p.location, flag: p.flag }
      : null;
    bookings = registrations.map((r) => ({
      id: r.id,
      type: r.type,
      detail: r.detail,
      category: r.category,
      level: r.level,
      location: r.location,
      flag: r.flag,
      mode: r.mode,
      period: r.period,
      plan: r.plan,
      paid: r.paid,
      status: r.status,
      statusTone: r.statusTone,
      amount: r.amount,
      vatRateBp: r.vatRateBp,
      vatMode: r.vatMode,
      vatAmount: r.vatAmount,
      discountCode: r.discountCode,
      notes: r.notes,
      bookedOn: r.createdAt
        ? r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : null,
    }));
  } else {
    logUnlessNoDb("student data", dataResult.reason);
  }

  return (
    <PortalClient
      userName={profile?.name ?? session.name}
      profile={profile}
      bookings={bookings}
      announcements={announcements}
    />
  );
}
