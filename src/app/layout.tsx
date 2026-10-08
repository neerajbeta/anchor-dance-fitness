import type { Metadata } from "next";
import { Inter, Poppins, Oswald } from "next/font/google";
import "./globals.css";
import { ScreenSwitcher } from "@/components/ScreenSwitcher";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anchor Fitness — Registration & Booking Portal",
  description:
    "Book dance classes, workshops, events and studio time — all in one place. Anchor Fitness.",
};

const themeInitScript = `(function(){try{var k='anchor-theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='dark'||s==='light'?s:(d?'dark':'light');var r=document.documentElement;if(t==='dark')r.classList.add('dark');r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} ${oswald.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <ScreenSwitcher />
        </ThemeProvider>
      </body>
    </html>
  );
}
