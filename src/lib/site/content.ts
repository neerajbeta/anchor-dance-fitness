// Content of the public website (moved from the old HTML site at
// anchorsports.se/dance-fitness). Edit text, prices and schedules here.
//
// Images: the originals still live on anchorsports.se. Copy the old site's
// `assets` folder to `public/site/assets` and set
// NEXT_PUBLIC_SITE_ASSETS_URL="/site/assets" to serve them from this app instead.

const ASSETS = (process.env.NEXT_PUBLIC_SITE_ASSETS_URL || "https://anchorsports.se/dance-fitness/assets").replace(/\/$/, "");

/** URL of an asset from the old site's `assets` folder (path as it was there). */
export const asset = (path: string) => `${ASSETS}/${path.split("/").map(encodeURIComponent).join("/")}`;

export const CONTACT = {
  phone: "+46 720284478",
  phoneHref: "tel:+46720284478",
  whatsapp: "https://wa.me/46720284478",
  email: "info@anchorsports.se",
  addresses: [
    "Stupvägen 1, 191 42 Sollentuna, Sweden",
    "Hans Stahles väg, 147 41 Tumba, Sweden",
    "2nd Floor, Kotia Nirman, Office No. B/204, Next to Yash Raj Films, Mumbai, Maharashtra 400053",
  ],
  social: [
    { label: "Facebook", href: "https://m.facebook.com/61580027196976/", icon: "facebook" },
    { label: "Instagram", href: "https://instagram.com/anchor_dance_n_fitness", icon: "instagram" },
    { label: "YouTube", href: "https://www.youtube.com/@anchor_dance_n_fitness", icon: "youtube" },
  ] as const,
};

export const HERO = {
  line1: "ANCHOR",
  line2: "Dance & Fitness",
  text: "Dance with us to express, connect, and celebrate. Let movement build your energy, balance, and confidence, while we create a vibrant community that unites with purpose.",
  images: [
    { src: "images/hero/Mentor-Akash01.webp", alt: "Dancer performing graceful pose" },
    { src: "images/hero/Mentor-Vinayak02.webp", alt: "Fitness class in action" },
    { src: "images/hero/Mentor-Nikita03.webp", alt: "Yoga session" },
    { src: "images/hero/Mentor-Sachinthi04.webp", alt: "Kathak dance" },
  ],
};

export const CLASSES = {
  intro: "Whatever your style, we've got the perfect class to help you feel more alive and stronger than ever.",
  items: [
    { title: ["Bollywood", "Dance"], text: "Unleash your inner star with energetic moves and vibrant music.", icon: "images/icons/class-01.webp", alt: "Bollywood dance icon" },
    { title: ["Zumba"], text: "Dance your way to fitness with high-energy, fun-filled routines.", icon: "images/icons/class-02.webp", alt: "Zumba fitness icon" },
    { title: ["Yoga"], text: "Find your balance and inner peace through mindful movement.", icon: "images/icons/class-03.webp", alt: "Yoga meditation icon" },
    { title: ["Kathak &", "Semi-Classical"], text: "Experience the grace and storytelling of this classical dance form.", icon: "images/icons/class-04.webp", alt: "Kathak classical dance icon" },
  ],
};

export const ABOUT = {
  title: ["Moves That Feel Like", "Freedom"],
  text: "At Anchor Dance, movement is celebration. Every class is crafted to let rhythm challenge your body, elevate your spirit, and awaken your energy.",
  revolution: ["This is a Revolution.", "And we invite you to be a part of it."],
  video: "videos/fitness.mov",
};

export const VISION =
  "We aspire to cultivate a vibrant community where art, wellness, and tradition come together - inviting people of all backgrounds to experience the timeless wisdom of India. Through the harmony of rhythm, movement, and mindfulness, we aim to share Indian dance and yoga with the world - not only as practices of health and creativity, but also as bridges that foster cultural connection and harmony.";

export type Trainer = {
  id: string;
  name: string;
  tags: string[];
  card: string; // photo on the card
  photo: string; // photo in the "Know more" window
  summary: string;
  /** Paragraphs; **text** is shown bold. */
  bio: string[];
  gallery: string[];
};

const gallery = (who: string, files: string[]) => files.map((f) => `images/gallery/${who}/${f}`);

export const TRAINERS: Trainer[] = [
  {
    id: "vinayak",
    name: "Vinayak Morvekar",
    tags: ["Bollywood", "Zumba"],
    card: "images/trainers/vinayakaa.webp",
    photo: "images/trainers/vinayakaa.webp",
    summary: "Vinayak brings electrifying energy to every class. His passion for Bollywood Dance and Zumba is contagious, transforming each session into a celebration of movement and rhythm.",
    bio: [
      "Vinayak's got moves, and a story, with more than 20 years of dancing from **India's biggest award nights to crowds in 15+ countries**. Trained in everything from Bollywood and hip-hop to freestyle and folk, he's rocked the stage with stars like **Himesh Reshammiya** and **Anjana Sukhani**, and brought his unique energy to global events like **Star Parivaar Awards** and the **World Military Games**.",
      "What makes Vinayak a favorite? He turns every class into a party, teaching you cool choreography and showing you how to move with confidence. Whether you're a total beginner or an aspiring star, he keeps things lively, fresh, and supportive.",
    ],
    gallery: gallery("vinayak", ["3.png", "4.png", "5.png", "6.png", "7.png", "8.png", "vinayak (2).webp", "vinayak (4).webp"]),
  },
  {
    id: "akash",
    name: "Akash More",
    tags: ["Bollywood", "Zumba"],
    card: "images/trainers/akash-01.webp",
    photo: "images/trainers/akash-01.webp",
    summary: "Akash's dynamic teaching style and street dance expertise make every class an adventure. He believes dance is the ultimate form of self-expression.",
    bio: [
      "Dance isn't just what Akash does, it's who he is! **Fourteen years of living the art**, from legendary Bollywood beats to soul-stirring classical grooves, has taken him on wild journeys across stages everywhere. He's danced alongside the industry's best, rocked blockbuster movies like **Padmavat** and **Tum Bin 2**, and even captured the spotlight on crowd-favorite shows like **Dance India Dance** and **Nach Baliye**.",
      "Akash's style? It's all heart, precision, and pure storytelling, each move invites you to jump in and feel the magic for yourself. Whether you're learning your first steps or want to nail that advanced routine, he turns every session into a celebration. Students love his infectious excitement and the way he helps everyone step out, let go, and discover their rhythm.",
    ],
    gallery: gallery("akash", ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png"]),
  },
  {
    id: "nikita",
    name: "Nikita Solanki",
    tags: ["Yoga", "Sound Therapy"],
    card: "images/trainers/nikitaa.webp",
    photo: "images/trainers/nikitaa.webp",
    summary: "Nikita combines ancient wisdom with modern techniques. Her mindful approach helps students find strength, flexibility, and inner peace.",
    bio: [
      "Yoga with her isn't just about stretches, it's a journey! Trained at **SVYASA** and **Sivananda**, she's spent around **10 years** helping people move, breathe, and thrive. From guiding busy minds at **ISRO** and **ICICI Bank** to lighting up TV screens on **TataSky Fitness** and **Disney+ Hotstar**, her reach is truly inspiring.",
      "She's coached thousands, including stars like **Shraddha Das** and **Khushali Kumar**, and has been featured in **New Woman magazine** and on **NatGeo** for her fresh take on yoga and cycling. Her style blends ancient wisdom with modern science to help you ditch stress, tune in to your body, and feel good inside and out.",
      "What really makes her stand out? A gentle, creative spark that makes every class feel welcoming. Whether she's working with kids, professionals, or anyone seeking calm, her sessions mix mindfulness, care, and personal touch so everyone leaves feeling stronger and happier.",
    ],
    gallery: gallery("nikita", ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png"]),
  },
  {
    id: "sachinthi",
    name: "Sachinthi Bandaranayake",
    tags: ["Kathak", "Semi-Classical"],
    card: "images/trainers/sachinthi-bandaranayakeii.webp",
    photo: "images/trainers/sachinthi-bandaranayakeii.webp",
    summary: "Sachinthi brings grace, rhythm, and storytelling to Kathak and semi-classical dance, blending tradition with expression to inspire and connect students to the art form.",
    bio: [
      "From Sri Lanka's colorful shores to Sweden's tranquil beauty, Sachinthi brings a vibrant mix of culture and grace to every dance move. Her style fuses the refined art of Indian classical dance with the spirit of **Sri Lankan tradition**, weaving emotion and discipline into something truly special.",
      "With over **ten years** of intense training under respected gurus, her passion goes far beyond steps and technique. Each performance is more than just dance, it's a story. Her footwork, gestures, and expressive storytelling invite you to journey through centuries of history, all seen through her fresh, modern lens.",
      "But what really sets her apart is how she teaches. She connects every student to the deeper stories behind each movement, proving that classical dance isn't just a tradition, it's living art that speaks to us today. Her sessions at Anchor Dance & Fitness celebrate the joy, discipline, and rich cultural roots of dance.",
    ],
    gallery: gallery("sachinthi", ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png"]),
  },
  {
    id: "tejas",
    name: "Tejas Subhash Kamble",
    tags: ["Bollywood"],
    card: "images/trainers/tejas-02.webp",
    photo: "images/trainers/tejas-01.webp",
    summary: "Tejas brings big-screen energy from hits like Tanhaji and Band Baaja Baaraat straight to the studio. With vast experience in films and reality shows, he transforms every performance into a cinematic experience.",
    bio: [
      "Tejas isn't just a dancer, he's a performer who has lived the stage life for almost two decades. He's assisted on **Nach Baliye** and danced in blockbuster films like **Tanhaji**, **Dilwale**, **Happy New Year**, **Azhar**, and **Band Baaja Baaraat**.",
      "He's worked with top choreographers such as **Bosco–Caesar**, **Ganesh Acharya**, **Remo D'Souza**, **Ganesh Hegde**, **Longie Fernandes**, and **Vibha Merchant**, learning to blend precision with performance flair. From **IIFA** and **Filmfare** to **SIIMA**, **Femina Miss India**, **IPL openings**, and the **Taj Express Musical World Tour**, he has performed on some of the world's biggest stages. At Anchor Dance & Fitness, he brings this elite professional training to his students, focusing on performance quality, rhythm, and authentic Bollywood style.",
    ],
    gallery: gallery("tejas", ["1.png", "2.png", "3.png", "4.png", "6.png", "7.png", "8.png", "Untitled-1.png"]),
  },
];

export const PROGRAMS = {
  items: [
    { title: "Personal Sessions", text: "Personalized training tailored to your specific goals", image: "images/programs/11-sessions.webp", alt: "Personal dance session" },
    { title: "Virtual Group Sessions", text: "Connect from home with our live virtual sessions", image: "images/programs/program-02.png", alt: "Online fitness class" },
    { title: "Studio Group Sessions", text: "Join our vibrant community in our state-of-the-art studio", image: "images/programs/program-03.png", alt: "Group class in the studio" },
    { title: "Workplace Wellness Sessions", text: "Bring wellness to your workplace with our workplace programs", image: "images/programs/workplace-wellness-sessions.webp", alt: "Corporate wellness session" },
  ],
  outro: "Join us for a class where every move inspires, every rhythm connects, and every moment comes alive.",
};

export const CTA = {
  title: ["Ready to", "Move", "with Us?"],
  text: "Anchor Dance & Fitness is about celebrating movement and people. From beginners to pros, everyone belongs here.",
};

export const FOOTER_TEXT =
  "Where movement meets artistry. Join our community of dancers and fitness enthusiasts as we explore the transformative power of dance and movement.";

// ── Schedule page ──

export type Slot = { day: string; time: string };
export type ScheduleGroup = { audience: string; slots: Slot[] };
export type ScheduleStyle = { style: string; groups: ScheduleGroup[] };
export type ScheduleBlock = { id: string; kicker: string; title: string; styles: ScheduleStyle[] };

export const SCHEDULE_NOTE = "All timings are in local Swedish time (CET). Subject to change — confirm via WhatsApp.";

export const SCHEDULE: ScheduleBlock[] = [
  {
    id: "online",
    kicker: "Online sessions",
    title: "Online — all locations",
    styles: [
      {
        style: "Bollywood",
        groups: [
          { audience: "Kids · Age 7–9", slots: [{ day: "Sunday", time: "11:00 – 12:00" }] },
          { audience: "Kids · Age 10–15", slots: [{ day: "Saturday", time: "12:30 – 13:30" }] },
          { audience: "Adults · 16+", slots: [{ day: "Sunday", time: "16:30 – 17:30" }] },
        ],
      },
      {
        style: "Yoga",
        groups: [
          {
            audience: "Adults",
            slots: [
              { day: "Mon / Tue / Wed", time: "06:00 – 07:00" },
              { day: "Sunday", time: "08:00 – 09:00" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "helenelund",
    kicker: "Physical · in-studio",
    title: "Helenelund",
    styles: [
      {
        style: "Bollywood",
        groups: [
          { audience: "Kids · Age 4–6", slots: [{ day: "Friday", time: "17:00 – 18:00" }, { day: "Sunday", time: "10:00 – 11:00" }] },
          { audience: "Kids · Age 7–9", slots: [{ day: "Wednesday", time: "17:00 – 18:00" }, { day: "Sunday", time: "12:30 – 13:30" }] },
          {
            audience: "Kids · Age 10+",
            slots: [
              { day: "Saturday", time: "17:00 – 18:00" },
              { day: "Saturday", time: "18:00 – 19:00" },
              { day: "Saturday", time: "12:00 – 13:00" },
              { day: "Monday", time: "17:00 – 18:00" },
            ],
          },
          { audience: "Adults · 16+", slots: [{ day: "Saturday", time: "10:30 – 11:30" }, { day: "Saturday", time: "16:00 – 17:00" }] },
        ],
      },
      {
        style: "Zumba",
        groups: [{ audience: "Adults", slots: [{ day: "Mon / Wed / Fri", time: "18:00 – 19:00" }, { day: "Sat / Sun", time: "08:00 – 09:00" }] }],
      },
      {
        style: "Kathak",
        groups: [
          { audience: "Kids", slots: [{ day: "Thursday", time: "18:00 – 19:00" }] },
          { audience: "Adults", slots: [{ day: "Sunday", time: "10:00 – 11:00" }] },
        ],
      },
    ],
  },
  {
    id: "tumba",
    kicker: "Physical · in-studio",
    title: "Tumba",
    styles: [
      {
        style: "Bollywood",
        groups: [
          { audience: "Kids", slots: [{ day: "Thursday", time: "18:00" }] },
          { audience: "Adults · 16+", slots: [{ day: "Sunday", time: "16:00 – 17:00" }] },
        ],
      },
      { style: "Zumba", groups: [{ audience: "Adults", slots: [{ day: "Sunday", time: "18:00 – 19:00" }] }] },
      {
        style: "Kathak",
        groups: [
          { audience: "Kids · Age 6–9", slots: [{ day: "TBD", time: "Yet to decide" }] },
          { audience: "Kids · Age 10+", slots: [{ day: "TBD", time: "Yet to decide" }] },
        ],
      },
    ],
  },
];

export type FeeRow = { mode: string; frequency: string; age?: string; monthly: number; quarterly: number; halfYearly: number };
export type FeeTable = { id: string; label: string; showAge: boolean; rows: FeeRow[] };

export const FEES: FeeTable[] = [
  {
    id: "bollywood",
    label: "Bollywood",
    showAge: true,
    rows: [
      { mode: "Online", frequency: "Weekly 1 class", age: "All ages", monthly: 200, quarterly: 550, halfYearly: 1050 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Kids below 10", monthly: 450, quarterly: 1250, halfYearly: 2400 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Kids 10–15", monthly: 500, quarterly: 1400, halfYearly: 2700 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Adults", monthly: 550, quarterly: 1550, halfYearly: 3000 },
    ],
  },
  {
    id: "zumba",
    label: "Zumba",
    showAge: false,
    rows: [
      { mode: "Online", frequency: "Weekly 1 class", monthly: 200, quarterly: 550, halfYearly: 1050 },
      { mode: "Online", frequency: "Weekly 3 classes", monthly: 500, quarterly: 1350, halfYearly: 2500 },
      { mode: "In-studio", frequency: "Weekly 2 classes", monthly: 500, quarterly: 1350, halfYearly: 2500 },
      { mode: "In-studio", frequency: "Weekly 3 classes", monthly: 800, quarterly: 2250, halfYearly: 4000 },
    ],
  },
  {
    id: "kathak",
    label: "Kathak & semi-classical",
    showAge: true,
    rows: [
      { mode: "Online", frequency: "Weekly 1 class", age: "All ages", monthly: 300, quarterly: 800, halfYearly: 1600 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Kids below 10", monthly: 450, quarterly: 1250, halfYearly: 2400 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Kids 10–15", monthly: 500, quarterly: 1400, halfYearly: 2700 },
      { mode: "In-studio", frequency: "Weekly 1 class", age: "Adults", monthly: 550, quarterly: 1550, halfYearly: 3000 },
    ],
  },
  {
    id: "yoga",
    label: "Yoga",
    showAge: false,
    rows: [
      { mode: "Online", frequency: "Weekly 1 class", monthly: 200, quarterly: 550, halfYearly: 1050 },
      { mode: "Online", frequency: "Weekly 3 classes", monthly: 500, quarterly: 1350, halfYearly: 2500 },
      { mode: "In-studio", frequency: "Weekly 1 class", monthly: 500, quarterly: 1350, halfYearly: 2500 },
      { mode: "In-studio", frequency: "Weekly 3 classes", monthly: 800, quarterly: 2250, halfYearly: 4000 },
    ],
  },
];

export const FEE_NOTES = {
  intro: "All prices in Swedish Kronor (SEK). Quarterly & Semester plans at special rates.",
  footer: "All plans are non-refundable once the term begins.",
};
