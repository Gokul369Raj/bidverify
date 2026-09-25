import { BrandMark } from "@/components/BrandMark";
import { BrandLogo } from "@/components/BrandLogo";

/* ─────────────────────────────────────────────────────────────────────────
   Compatibility layer.

   The app previously rendered the State Emblem of India in the masthead.
   That mark is legally restricted (State Emblem of India (Prohibition of
   Improper Use) Act, 2005) and this project is an unaffiliated SIH
   prototype, so it now renders the BidGuard AI mark instead.

   These exports keep the original call sites working unchanged:
     <Emblem height={44} variant="light" />
     <BrandLockup size="md" />
   ───────────────────────────────────────────────────────────────────────── */

export function Emblem({
  height = 44,
  variant = "dark",
  className = "",
}: {
  height?: number;
  variant?: "dark" | "light" | "gold";
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <BrandMark
      size={height}
      tone={variant === "light" ? "inverse" : "solid"}
      className={className}
    />
  );
}

export function BrandLockup({
  size = "md",
  variant = "dark",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light" | "gold";
  href?: string | null;
}) {
  return (
    <BrandLogo
      size={size}
      tone={variant === "light" ? "inverse" : "solid"}
      href={href}
    />
  );
}
