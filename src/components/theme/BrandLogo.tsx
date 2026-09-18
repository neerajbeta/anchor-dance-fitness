import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Height of the full logo (dancer tiles + "ANCHOR DANCE & FITNESS"); it's ~3.2× as wide.
const sizes = {
  sm: { mark: 32, logo: 46 },
  md: { mark: 44, logo: 52 },
  lg: { mark: 72, logo: 84 },
};

// White lettering for dark backgrounds, black lettering for light ones.
const LOGO_SRC = {
  dark: { src: "/brand/logo-on-dark.webp", width: 394, height: 123 },
  light: { src: "/brand/logo-on-light.webp", width: 447, height: 140 },
};

export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex flex-shrink-0 items-center justify-center rounded-[26%]", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: "linear-gradient(135deg,#EB3936 0%,#F16935 55%,#F89B47 100%)",
        boxShadow: "0 8px 22px rgba(235,57,54,0.32)",
      }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#fff">
        <path d="M13.6 3.4a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z" />
        <path d="M11.2 6.4c.9-.2 1.8.1 2.4.8l3.1 3.4c.4.4.3 1.1-.2 1.4-.4.3-1 .2-1.3-.2l-2-2.2-.6 3 2.5 3.9c.4.6.2 1.4-.4 1.8-.6.3-1.3.1-1.7-.5l-2.4-3.8-2.7 3.7c-.4.5-1.1.6-1.6.2-.5-.4-.6-1.1-.2-1.6l3.1-4.3.7-4.2-2 1.6-.9 2c-.2.5-.8.7-1.3.5-.5-.2-.7-.8-.5-1.3l1.1-2.5c.1-.3.3-.5.6-.7l2.5-1.4Z" />
      </svg>
    </span>
  );
}

export function BrandLogo({
  variant = "light",
  size = "md",
  href = "/",
  showWordmark = true,
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  href?: string | null;
  showWordmark?: boolean;
}) {
  const scale = sizes[size];
  const logo = LOGO_SRC[variant];
  const content = showWordmark ? (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt="Anchor Dance & Fitness"
      priority
      style={{ height: scale.logo, width: "auto" }}
    />
  ) : (
    <BrandMark size={scale.mark} />
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center no-underline">
      {content}
    </Link>
  );
}
