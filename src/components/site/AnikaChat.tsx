"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLASSES, CONTACT, FEES, FEE_NOTES, SCHEDULE, SCHEDULE_NOTE, TRAINERS } from "@/lib/site/content";

/**
 * "Anika" — the website's chat assistant (rebuilt from the old site's widget).
 * Answers from the site's own content (schedule, fees, classes, instructors,
 * contact) and sends people into the portal to book, see bookings or ask for a
 * demo. No external AI service — everything runs in the browser.
 */

type Lang = "en" | "sv";
type Action = { label: string; href: string };
type Msg = { from: "bot" | "user"; text: string; actions?: Action[] };

const T = (lang: Lang, en: string, sv: string) => (lang === "sv" ? sv : en);

const SV_WORDS = /\b(hej|hallå|tjena|boka|bokning|anmäl|schema|tider|klass|klasser|kurs|pris|kostar|kostnad|avgift|var ligger|adress|tack|avboka|återbetalning|prova|provlektion|mina bokningar|dans|barn|ålder|hur mycket)\b/i;

// Topic → keywords (English and Swedish). First match wins, in this order.
const INTENTS: { id: string; words: RegExp }[] = [
  { id: "lookup", words: /\b(my bookings?|my classes|my booking|what did i book|mina bokningar|min bokning|portal|my account|logga in|log ?in|sign ?in)\b/i },
  { id: "cancel", words: /\b(cancel|cancellation|refund|money back|avboka|avbokning|återbetalning|pengarna tillbaka)\b/i },
  { id: "trial", words: /\b(trial|demo|free class|try|taster|first class|prova|provlektion|testlektion|gratis)\b/i },
  // A named style wins over general topics: "When is Zumba?" → Zumba's times and prices.
  { id: "bollywood", words: /\bbollywood\b/i },
  { id: "zumba", words: /\bzumba\b/i },
  { id: "kathak", words: /\b(kathak|semi.?classical|classical)\b/i },
  { id: "yoga", words: /\b(yoga|sound therapy|meditation)\b/i },
  { id: "pricing", words: /\b(price|prices|pricing|cost|costs|fee|fees|how much|sek|kr|kronor|pay|payment|plan|plans|membership|monthly|quarterly|pris|priser|kostar|kostnad|avgift|betala|medlemskap|månad)\b/i },
  { id: "schedule", words: /\b(schedule|timetable|time|times|timing|when|which day|what day|days|weekend|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|schema|tider|tid|när|vilken dag|måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\b/i },
  { id: "booking", words: /\b(book|booking|reserve|register|sign ?up|join|enrol|enroll|start|boka|bokning|reservera|anmäl|anmäla|registrera|börja|gå med)\b/i },
  { id: "instructors", words: /\b(instructor|instructors|teacher|teachers|coach|coaches|trainer|trainers|who teaches|lärare|instruktör|tränare)\b/i },
  { id: "location", words: /\b(where|location|locations|address|studio|studios|helenelund|tumba|sollentuna|mumbai|directions|var ligger|adress|plats|lokal)\b/i },
  { id: "transport", words: /\b(parking|park|bus|train|metro|pendeltåg|transport|get there|parkering|buss|tåg|ta sig)\b/i },
  { id: "age", words: /\b(age|kids|kid|child|children|adult|adults|teen|teens|beginner|beginners|ålder|barn|vuxen|vuxna|nybörjare)\b/i },
  { id: "classes", words: /\b(class|classes|style|styles|dance|dances|what do you offer|offer|klass|klasser|dans|stil)\b/i },
  { id: "contact", words: /\b(contact|phone|call|email|mail|whatsapp|reach|talk to|human|person|kontakt|telefon|ring|maila|prata med)\b/i },
  { id: "thanks", words: /\b(thanks|thank you|thx|great|perfect|awesome|tack|toppen|perfekt)\b/i },
  { id: "greeting", words: /\b(hi|hello|hey|good (morning|afternoon|evening)|help|hej|hallå|tjena|hjälp)\b/i },
];

const sek = (n: number) => `${n.toLocaleString("sv-SE")} SEK`;

function scheduleFor(style: string, lang: Lang) {
  const lines: string[] = [];
  for (const block of SCHEDULE) {
    for (const s of block.styles) {
      if (s.style.toLowerCase() !== style.toLowerCase()) continue;
      const slots = s.groups.map((g) => `${g.audience}: ${g.slots.map((x) => `${x.day} ${x.time}`).join(", ")}`).join("\n  ");
      lines.push(`📍 ${block.title}\n  ${slots}`);
    }
  }
  return lines.length ? lines.join("\n") : T(lang, "No sessions listed right now.", "Inga pass listade just nu.");
}

function feesFor(id: string, lang: Lang) {
  const table = FEES.find((f) => f.id === id);
  if (!table) return "";
  const rows = table.rows
    .map((r) => `• ${r.mode}, ${r.frequency.toLowerCase()}${r.age ? ` (${r.age})` : ""}: ${sek(r.monthly)}${T(lang, "/month", "/mån")} · ${sek(r.quarterly)}${T(lang, "/quarter", "/kvartal")}`)
    .join("\n");
  return `${table.label}\n${rows}`;
}

const BOOK: Action = { label: "📅 Book a class", href: "/book/class" };
const SCHEDULE_PAGE: Action = { label: "🗓️ Full schedule & fees", href: "/schedule" };
const WHATSAPP: Action = { label: "💬 WhatsApp us", href: CONTACT.whatsapp };

function reply(input: string, lang: Lang): Msg {
  const intent = INTENTS.find((i) => i.words.test(input))?.id ?? "fallback";
  switch (intent) {
    case "greeting":
      return {
        from: "bot",
        text: T(lang, "Hi there! 👋 I can help with class info, schedules and prices — or get you booked in. What would you like to know?", "Hej! 👋 Jag kan hjälpa till med klasser, schema och priser — eller boka åt dig. Vad vill du veta?"),
        actions: [BOOK, SCHEDULE_PAGE],
      };
    case "booking":
      return {
        from: "bot",
        text: T(
          lang,
          "Great choice! 🎉 Booking takes under a minute: pick online or in-studio, choose your class and dates, then pay by card or Swish. Workshops, events and studio hire are booked the same way.",
          "Toppen! 🎉 Att boka tar under en minut: välj online eller i studion, välj klass och datum och betala med kort eller Swish. Workshops, event och studiohyra bokas på samma sätt."
        ),
        actions: [BOOK, { label: "🎭 Workshops & events", href: "/book/workshops" }, { label: "🏛️ Hire the studio", href: "/book/studio" }],
      };
    case "schedule":
      return {
        from: "bot",
        text: `${T(lang, "Here's when we dance:", "Här är när vi dansar:")}\n\n${["Bollywood", "Zumba", "Kathak", "Yoga"].map((s) => `${s}:\n${scheduleFor(s, lang)}`).join("\n\n")}\n\n${SCHEDULE_NOTE}`,
        actions: [SCHEDULE_PAGE, BOOK],
      };
    case "pricing":
      return {
        from: "bot",
        text: `${T(lang, "Our fees (a quarterly plan is the best value):", "Våra avgifter (kvartalsplan ger bäst värde):")}\n\n${FEES.map((f) => feesFor(f.id, lang)).join("\n\n")}\n\n${FEE_NOTES.footer}`,
        actions: [SCHEDULE_PAGE, BOOK],
      };
    case "bollywood":
    case "zumba":
    case "kathak":
    case "yoga": {
      const name = { bollywood: "Bollywood", zumba: "Zumba", kathak: "Kathak", yoga: "Yoga" }[intent];
      const blurb = CLASSES.items.find((c) => c.title.join(" ").toLowerCase().includes(intent))?.text ?? "";
      const teachers = TRAINERS.filter((t) => t.tags.some((g) => g.toLowerCase().includes(intent === "kathak" ? "kathak" : intent))).map((t) => t.name);
      return {
        from: "bot",
        text: `${name} — ${blurb}\n\n${teachers.length ? `${T(lang, "Taught by", "Leds av")} ${teachers.join(", ")}.\n\n` : ""}${T(lang, "When:", "När:")}\n${scheduleFor(name, lang)}\n\n${T(lang, "Prices:", "Priser:")}\n${feesFor(intent, lang)}`,
        actions: [BOOK, SCHEDULE_PAGE],
      };
    }
    case "classes":
      return {
        from: "bot",
        text: `${T(lang, "We offer:", "Vi erbjuder:")}\n${CLASSES.items.map((c) => `• ${c.title.join(" ")} — ${c.text}`).join("\n")}\n\n${T(lang, "Online and in-studio in Helenelund and Tumba, for kids and adults.", "Online och i studion i Helenelund och Tumba, för barn och vuxna.")}`,
        actions: [BOOK, SCHEDULE_PAGE],
      };
    case "instructors":
      return {
        from: "bot",
        text: `${T(lang, "Meet our team:", "Möt vårt team:")}\n${TRAINERS.map((t) => `• ${t.name} — ${t.tags.join(", ")}`).join("\n")}`,
        actions: [{ label: "👩‍🏫 See the team", href: "/#trainers" }, BOOK],
      };
    case "location":
      return {
        from: "bot",
        text: `${T(lang, "Our studios:", "Våra studior:")}\n${CONTACT.addresses.map((a) => `📍 ${a}`).join("\n")}\n\n${T(lang, "Can't make it in person? Most styles also run online.", "Kan du inte komma på plats? De flesta stilar finns även online.")}`,
        actions: [SCHEDULE_PAGE, WHATSAPP],
      };
    case "transport":
      return {
        from: "bot",
        text: T(
          lang,
          `Our Helenelund studio is at ${CONTACT.addresses[0]} and Tumba at ${CONTACT.addresses[1]} — both are easy to reach by commuter train (pendeltåg) and bus. Message us on WhatsApp for parking tips.`,
          `Studion i Helenelund ligger på ${CONTACT.addresses[0]} och Tumba på ${CONTACT.addresses[1]} — båda nås enkelt med pendeltåg och buss. Skriv till oss på WhatsApp för parkeringstips.`
        ),
        actions: [WHATSAPP],
      };
    case "age":
      return {
        from: "bot",
        text: T(
          lang,
          "Everyone is welcome — from kids (age 4+) to adults 16+, total beginners to experienced dancers. Kids' Bollywood groups are split by age (4–6, 7–9, 10+) so everyone learns at the right pace.",
          "Alla är välkomna — från barn (4 år och uppåt) till vuxna 16+, nybörjare som erfarna. Barngrupperna i Bollywood delas efter ålder (4–6, 7–9, 10+)."
        ),
        actions: [SCHEDULE_PAGE, BOOK],
      };
    case "trial":
      return {
        from: "bot",
        text: T(
          lang,
          "Want to try us out first? Book a demo class — tell us what you're interested in and we'll set it up. 💃",
          "Vill du prova först? Boka en provlektion — berätta vad du är intresserad av så ordnar vi det. 💃"
        ),
        actions: [{ label: "✨ Book a demo", href: "/book" }, WHATSAPP],
      };
    case "lookup":
      return {
        from: "bot",
        text: T(lang, "Your bookings, receipts, invoices and class calendar are all in My Portal — just sign in.", "Dina bokningar, kvitton, fakturor och din kalender finns i Mina sidor — logga bara in."),
        actions: [{ label: "🔐 Sign in to My Portal", href: "/login" }],
      };
    case "cancel":
      return {
        from: "bot",
        text: T(
          lang,
          `${FEE_NOTES.footer} For anything else about a booking, contact us and we'll help.`,
          "Alla planer är ej återbetalningsbara när terminen har börjat. För annat kring en bokning, kontakta oss så hjälper vi dig."
        ),
        actions: [WHATSAPP, { label: "✉️ Email us", href: `mailto:${CONTACT.email}` }],
      };
    case "contact":
      return {
        from: "bot",
        text: `📞 ${CONTACT.phone}\n✉️ ${CONTACT.email}\n${T(lang, "WhatsApp is the fastest way to reach us.", "WhatsApp är snabbaste sättet att nå oss.")}`,
        actions: [WHATSAPP, { label: "📞 Call", href: CONTACT.phoneHref }],
      };
    case "thanks":
      return { from: "bot", text: T(lang, "You're welcome! 😊 See you on the dance floor!", "Varsågod! 😊 Vi ses på dansgolvet!") };
    default:
      return {
        from: "bot",
        text: T(
          lang,
          "I'm not sure I got that. I can help with booking, schedules, prices, our classes and studios — or you can message the team directly.",
          "Jag förstod inte riktigt. Jag kan hjälpa till med bokning, schema, priser, klasser och studior — eller skriv direkt till teamet."
        ),
        actions: [BOOK, SCHEDULE_PAGE, WHATSAPP],
      };
  }
}

const QUICK = [
  { label: "📞 Book a Class", text: "I want to book a class" },
  { label: "💰 Pricing", text: "What are your prices?" },
  { label: "📅 Class Schedules", text: "Show me the schedule" },
];

const WELCOME: Msg = {
  from: "bot",
  text: "Hi there! 👋 Welcome to Anchor Dance & Fitness!\nI'm Anika, your virtual assistant.\n\nI can help you with class info, schedules, pricing — and get you booked in. What can I do for you?",
};

export function AnikaChat() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [unread, setUnread] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // The little "Need help?" bubble appears after a few seconds (unless dismissed before).
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("anika-teaser") === "closed";
    } catch {
      /* private mode */
    }
    if (dismissed) return;
    const t = setTimeout(() => setTeaser(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, typing, open]);

  function closeTeaser() {
    setTeaser(false);
    try {
      sessionStorage.setItem("anika-teaser", "closed");
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setOpen((v) => !v);
    setUnread(false);
    setTeaser(false);
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const lang: Lang = SV_WORDS.test(clean) ? "sv" : "en";
    setMsgs((m) => [...m, { from: "user", text: clean }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, reply(clean, lang)]);
    }, 550);
  }

  return (
    <>
      {/* Teaser bubble */}
      {teaser && !open && (
        <div className="fixed bottom-[104px] right-7 z-[60] flex max-w-[240px] items-start gap-2.5 rounded-2xl border border-[#e9ecef] bg-white p-3 pr-7 shadow-[0_8px_32px_rgba(234,56,53,0.18)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-[15px]" aria-hidden>
            💃
          </span>
          <button type="button" onClick={toggle} className="text-left">
            <div className="text-[11px] font-bold text-[#ea3835]">Anika</div>
            <div className="text-[12.5px] leading-[1.4] text-[#333]">👋 Hi! Need help booking a class?</div>
          </button>
          <button type="button" onClick={closeTeaser} aria-label="Close" className="absolute right-2 top-1.5 text-[14px] leading-none text-[#999] hover:text-[#333]">
            ✕
          </button>
        </div>
      )}

      {/* Chat window */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Anika"
          className="fixed bottom-[104px] right-4 z-[60] flex h-[min(560px,calc(100vh-130px))] w-[calc(100vw-32px)] max-w-[370px] flex-col overflow-hidden rounded-[18px] border border-[#e9ecef] bg-white shadow-[0_8px_32px_rgba(234,56,53,0.18)] sm:right-7"
        >
          <div className="flex items-center gap-3 bg-gradient-to-br from-[#ea3835] to-[#f89b46] px-4 py-3.5 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[20px]" aria-hidden>
              🤖
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight">Anika — AI Assistant</div>
              <div className="flex items-center gap-1.5 text-[12px] text-white/90">
                <span className="h-2 w-2 rounded-full bg-[#7CFFB2]" aria-hidden /> Online · Anchor Dance &amp; Fitness
              </div>
            </div>
            <button type="button" onClick={toggle} aria-label="Close chat" className="rounded-full p-1.5 text-[18px] leading-none text-white/90 hover:bg-white/15">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8f9fa] px-4 py-4">
            {msgs.map((m, i) =>
              m.from === "bot" ? (
                <div key={i} className="flex items-end gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-[13px]" aria-hidden>
                    🤖
                  </span>
                  <div className="max-w-[85%]">
                    <div className="whitespace-pre-line rounded-2xl rounded-bl-md border border-[#e9ecef] bg-white px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-[#212529]">{m.text}</div>
                    {m.actions && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((a) =>
                          a.href.startsWith("http") || a.href.startsWith("mailto:") || a.href.startsWith("tel:") ? (
                            <a key={a.label} href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="rounded-full border border-[#ea3835]/40 bg-white px-3 py-1 text-[12.5px] font-semibold text-[#ea3835] no-underline hover:bg-[#ea3835] hover:text-white">
                              {a.label}
                            </a>
                          ) : (
                            <Link key={a.label} href={a.href} className="rounded-full border border-[#ea3835]/40 bg-white px-3 py-1 text-[12.5px] font-semibold text-[#ea3835] no-underline hover:bg-[#ea3835] hover:text-white">
                              {a.label}
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-gradient-to-br from-[#ea3835] to-[#f89b46] px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-white">{m.text}</div>
                </div>
              )
            )}
            {typing && (
              <div className="flex items-center gap-2 text-[12px] text-[#6c757d]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-[13px]" aria-hidden>
                  🤖
                </span>
                Anika is typing…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-[#e9ecef] bg-white px-3 pt-2.5">
            {QUICK.map((q) => (
              <button key={q.label} type="button" onClick={() => send(q.text)} className="rounded-full border border-[#ea3835]/40 px-3 py-1 text-[12.5px] font-semibold text-[#ea3835] hover:bg-[#ea3835] hover:text-white">
                {q.label}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 bg-white px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              aria-label="Message"
              maxLength={300}
              className="min-w-0 flex-1 rounded-full border border-[#e9ecef] bg-[#f8f9fa] px-4 py-2 text-[13.5px] text-[#212529] outline-none focus:border-[#ea3835]"
            />
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-white disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" />
              </svg>
            </button>
          </form>
          <div className="bg-white pb-2 text-center text-[10.5px] text-[#adb5bd]">Powered by Anchor AI</div>
        </div>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close chat" : "Chat with Anika"}
        className="fixed bottom-7 right-7 z-[60] flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-white shadow-[0_8px_32px_rgba(234,56,53,0.18)] transition hover:scale-105"
      >
        {!open && <span className="absolute inset-0 animate-ping rounded-full bg-[#ea3835]/25" aria-hidden />}
        {open ? (
          <span className="text-[22px] leading-none">✕</span>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#2e9e6b] text-[10px] font-bold text-white">1</span>
        )}
      </button>
    </>
  );
}
