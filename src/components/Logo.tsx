/**
 * Anchor Fitness logo mark — a rounded tile with the brand orange→red gradient
 * and a white dancer silhouette, echoing the supplied logo artwork.
 */
export function LogoMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-[26%] shadow-glow ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "linear-gradient(135deg,#F7942E 0%,#EF5B2B 55%,#E63E2B 100%)",
      }}
      aria-hidden
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="#fff"
      >
        {/* Stylised dancer */}
        <path d="M13.6 3.4a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z" />
        <path d="M11.2 6.4c.9-.2 1.8.1 2.4.8l3.1 3.4c.4.4.3 1.1-.2 1.4-.4.3-1 .2-1.3-.2l-2-2.2-.6 3 2.5 3.9c.4.6.2 1.4-.4 1.8-.6.3-1.3.1-1.7-.5l-2.4-3.8-2.7 3.7c-.4.5-1.1.6-1.6.2-.5-.4-.6-1.1-.2-1.6l3.1-4.3.7-4.2-2 1.6-.9 2c-.2.5-.8.7-1.3.5-.5-.2-.7-.8-.5-1.3l1.1-2.5c.1-.3.3-.5.6-.7l2.5-1.4Z" />
      </svg>
    </span>
  );
}

export function LogoWordmark({
  size = 34,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span
        className="font-display font-extrabold leading-none"
        style={{ fontSize: size * 0.5, color: dark ? "#211a16" : "#fff" }}
      >
        Anchor<span className="text-brand-500"> Fitness</span>
      </span>
    </span>
  );
}
