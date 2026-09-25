import Image from "next/image";

/* ─────────────────────────────────────────────────────────────────────────
   Bidguard AI brand mark — the "b" + shield + blue tick supplied by the team.

   Shipped as a PNG because the supplied artwork is a raster logo. It is
   pre-sized (141x200 master) so it stays sharp well past DPR 3 without the
   image optimiser needing to generate extra variants.

   `tone="inverse"` swaps to the white-ink variant for navy surfaces — the tick
   keeps its blue but lightened, because #0968FE on navy is only about 2:1.
   ───────────────────────────────────────────────────────────────────────── */

const RATIO = 141 / 200; // master width / height

export function BrandMark({
  size = 40,
  className = "",
  tone = "solid",
  /** Give the mark an accessible name only where it stands alone. */
  alt = "",
}: {
  /** Rendered height in px. */
  size?: number;
  className?: string;
  tone?: "solid" | "inverse";
  alt?: string;
}) {
  const src = tone === "inverse" ? "/images/brand/mark-inverse.png" : "/images/brand/mark.png";
  const w = Math.round(size * RATIO);
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={size}
      priority
      aria-hidden={alt ? undefined : true}
      className={className}
      sizes={`${w}px`}
      style={{ height: size, width: w, flexShrink: 0 }}
    />
  );
}

export default BrandMark;