import Image from "next/image";

/* ─────────────────────────────────────────────────────────────────────────
   Bidguard AI wordmark lockup — the supplied mark plus "Bidguard AI", already
   composed into a single asset so the mark and the lettering always keep their
   designed proportions.

   Two variants: navy-on-transparent for light surfaces, white-on-transparent
   for navy surfaces.
   ───────────────────────────────────────────────────────────────────────── */

const RATIO = 489 / 132; // master width / height

export function BrandLogo({
  size = "md",
  tone = "solid",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  tone?: "solid" | "inverse";
  href?: string | null;
}) {
  const height = size === "sm" ? 30 : size === "lg" ? 52 : 40;
  const w = Math.round(height * RATIO);
  const src = tone === "inverse"
    ? "/images/brand/logo-horizontal-inverse.png"
    : "/images/brand/logo-horizontal.png";

  const img = (
    <Image
      src={src}
      alt="Bidguard AI"
      width={w}
      height={height}
      priority
      sizes={`${w}px`}
      style={{ height, width: w }}
    />
  );

  if (!href) return img;
  return (
    <a href={href} className="shrink-0 inline-flex items-center" aria-label="Bidguard AI — home">
      {img}
    </a>
  );
}

export default BrandLogo;