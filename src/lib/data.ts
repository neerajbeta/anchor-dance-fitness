// Mock data for the Anchor Fitness portal (UI-only, per architecture doc P1 scope).

export const CATEGORIES = ["Yoga", "Zumba", "Bollywood Dance"];
export const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export type BookingType = "class" | "workshop" | "event" | "studio";

export type Registration = {
  id: string;
  name: string;
  email: string;
  age: number;
  initial: string;
  color: string;
  location: string;
  flag: string;
  type: BookingType;
  detail: string;
  category?: string;
  level?: string;
  mode?: "online" | "offline";
  period: string;
  plan: string;
  paid: "paid" | "overdue" | "pending" | "onetime";
  status: string;
  statusTone: "ok" | "warn" | "danger" | "info" | "gray";
  amount?: number;
  discountCode?: string | null;
  notes?: string | null; // customer's own notes from the booking form
};

export const REGISTRATIONS: Registration[] = [
  { id: "AF-0091", name: "Priya Sharma", email: "priya@example.com", age: 28, initial: "P", color: "#EF5B2B", location: "Stockholm", flag: "🇸🇪", type: "class", detail: "Batch TBD", category: "Bollywood", level: "Beginner", mode: "online", period: "Aug–Oct 2025", plan: "Quarterly", paid: "paid", status: "Pending Batch", statusTone: "warn" },
  { id: "AF-0090", name: "Layla Hassan", email: "layla@example.com", age: 35, initial: "L", color: "#DC4A3D", location: "Stockholm", flag: "🇸🇪", type: "class", detail: "Evening C", category: "Zumba", level: "Intermediate", mode: "offline", period: "Jul–Sep 2025", plan: "Monthly", paid: "overdue", status: "At Risk", statusTone: "danger" },
  { id: "AF-0089", name: "Rania Malik", email: "rania@example.com", age: 22, initial: "R", color: "#2E9E6B", location: "Mumbai", flag: "🇮🇳", type: "workshop", detail: "Bollywood Fusion Masterclass", mode: "offline", period: "10 Aug 2025", plan: "One-time", paid: "onetime", status: "Confirmed", statusTone: "ok" },
  { id: "AF-0088", name: "Sofia Berg", email: "sofia@example.com", age: 30, initial: "S", color: "#8B5CF6", location: "Stockholm", flag: "🇸🇪", type: "studio", detail: "Thu 11AM–12PM · Personal Practice", period: "7 Aug 2025", plan: "Studio 1hr", paid: "paid", status: "Confirmed", statusTone: "ok" },
  { id: "AF-0087", name: "Anita Johansson", email: "anita@example.com", age: 41, initial: "A", color: "#E0972B", location: "Stockholm", flag: "🇸🇪", type: "class", detail: "Morning A", category: "Yoga", level: "Advanced", mode: "online", period: "Jun–Dec 2025", plan: "Annual", paid: "paid", status: "Active", statusTone: "ok" },
  { id: "AF-0086", name: "Marco Rossi", email: "marco@example.com", age: 25, initial: "M", color: "#3B82C4", location: "London", flag: "🇬🇧", type: "event", detail: "Contemporary Dance Showcase", mode: "online", period: "17 Aug 2025", plan: "One-time", paid: "onetime", status: "Confirmed", statusTone: "ok" },
];

export type EventItem = {
  id: string;
  kind: "workshop" | "event";
  title: string;
  emoji: string;
  gradient: string;
  date: string;
  desc: string;
  mode: "online" | "offline";
  location: string;
  coach: string;
  price: number;
  seatsLeft: number;
  seatsTotal: number;
  media: string;
  past?: boolean;
  attended?: number;
  eventDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

export const EVENTS: EventItem[] = [
  { id: "ev1", kind: "workshop", title: "Bollywood Fusion Masterclass", emoji: "💃", gradient: "linear-gradient(135deg,#2E2620,#5C534B)", date: "SAT, 10 AUG 2025 · 11:00 AM – 1:00 PM", desc: "An intensive 2-hour masterclass covering classic Bollywood choreography with a contemporary twist. Suitable for intermediate and above dancers.", mode: "online", location: "Stockholm", coach: "Coach Leila", price: 450, seatsLeft: 8, seatsTotal: 20, media: "📷 3 photos · 1 video" },
  { id: "ev2", kind: "event", title: "Contemporary Dance Showcase", emoji: "🌟", gradient: "linear-gradient(135deg,#3a1f14,#7A241A)", date: "SUN, 17 AUG 2025 · 3:00 PM – 5:00 PM", desc: "A special performance event featuring students and guest artists. Open to all levels. Spectators welcome — limited stage-side seats available.", mode: "online", location: "All Locations", coach: "Coach Maria", price: 380, seatsLeft: 14, seatsTotal: 30, media: "📷 5 photos" },
  { id: "ev3", kind: "workshop", title: "Latin Rhythms Workshop", emoji: "💃", gradient: "linear-gradient(135deg,#2d2620,#4a5568)", date: "SAT, 24 AUG 2025 · 10:00 AM – 12:00 PM", desc: "High-energy Latin dance workshop covering Salsa, Bachata and Cha-cha fundamentals. All levels welcome.", mode: "offline", location: "Mumbai", coach: "Coach Ana", price: 420, seatsLeft: 0, seatsTotal: 20, media: "📷 2 photos" },
];

export const PAST_EVENTS: EventItem[] = [
  { id: "pev1", kind: "workshop", title: "Afrobeat Dance Intensive", emoji: "🥁", gradient: "linear-gradient(135deg,#3a2414,#7A241A)", date: "SAT, 12 JUL 2025 · 2:00 PM – 4:00 PM", desc: "A sold-out session exploring Afrobeat rhythms and movement. 24 attendees.", mode: "offline", location: "Stockholm", coach: "Coach Leila", price: 400, seatsLeft: 0, seatsTotal: 24, media: "📷 8 photos · 2 videos", past: true, attended: 24 },
  { id: "pev2", kind: "event", title: "Anchor Fitness Annual Showcase", emoji: "🎉", gradient: "linear-gradient(135deg,#2d1a14,#96291B)", date: "SUN, 6 JUL 2025 · 5:00 PM – 8:00 PM", desc: "Annual student showcase with guest performances and prize ceremony.", mode: "offline", location: "Mumbai", coach: "Coach Maria", price: 0, seatsLeft: 0, seatsTotal: 60, media: "📷 12 photos", past: true, attended: 60 },
];
