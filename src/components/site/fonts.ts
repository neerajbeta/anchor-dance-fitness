import { Inter, Poppins } from "next/font/google";

// The public website loads its own copies of Inter and Poppins. The portal's
// globals.css sets --font-sans / --font-display to the plain names "Inter" /
// "Poppins", which aren't installed, so those pages fall back to system fonts;
// the website must match the original site exactly, so it doesn't rely on them.
export const siteInter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
export const sitePoppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--site-display",
});

/** Root class for a website page: Inter as the body font, Poppins available for headings. */
export const siteFontClass = `${siteInter.className} ${sitePoppins.variable}`;
