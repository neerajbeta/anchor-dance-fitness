// Shared look of the public website — matches the original anchorsports.se site.

export const SITE = {
  /**
   * Bootstrap container, as on the original: 12px gutters and a max width that
   * steps with the window — 540 / 720 / 960 / 1140 / 1320px from 576 / 768 /
   * 992 / 1200 / 1400px wide.
   */
  container:
    "mx-auto w-full px-3 min-[576px]:max-w-[540px] min-[768px]:max-w-[720px] min-[992px]:max-w-[960px] min-[1200px]:max-w-[1140px] min-[1400px]:max-w-[1320px]",
  /** Headings font (Poppins, loaded in ./fonts). */
  display: "[font-family:var(--site-display),Poppins,sans-serif]",
  /** Hero / CTA background. */
  darkBg: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)",
  /** Brand gradient (top → bottom, as on the original). */
  gradient: "bg-gradient-to-b from-[#ea3835] to-[#f89b46]",
  gradientText: "bg-gradient-to-b from-[#ea3835] to-[#f89b46] bg-clip-text text-transparent",
  /** The site's gradient pill button (18px, bold, uppercase). */
  button:
    "inline-flex min-h-[50px] min-w-[150px] items-center justify-center gap-2 rounded-[50px] bg-gradient-to-b from-[#ea3835] to-[#f89b46] px-[35px] py-[15px] text-[16px] font-bold uppercase leading-[1.5] tracking-[1px] text-white no-underline shadow-[0_8px_24px_rgba(234,56,53,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(234,56,53,0.45)] sm:text-[18px]",
};
