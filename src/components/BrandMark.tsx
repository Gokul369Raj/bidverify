/* ─────────────────────────────────────────────────────────────────────────
   BidGuard AI brand mark — pure inline SVG.

   Concept, "verified, and Indian":
     • a shield          → the integrity of the verification
     • an inner ring     → an Ashoka-chakra reference, without using the
                           State Emblem (which is legally restricted)
     • a saffron tick    → the verification result
     • a tricolour base  → national identity

   Inline SVG rather than a bitmap: stays sharp at every size and costs no
   extra network request.
   ───────────────────────────────────────────────────────────────────────── */

export function BrandMark({
  size = 40,
  className = "",
  /** `solid` for light backgrounds, `inverse` for navy backgrounds. */
  tone = "solid",
}: {
  size?: number;
  className?: string;
  tone?: "solid" | "inverse";
}) {
  const inverse = tone === "inverse";
  const uid = inverse ? "bgMarkInv" : "bgMarkSolid";

  const shieldTop = inverse ? "#FFFFFF" : "#12467F";
  const shieldBottom = inverse ? "#DCE7F4" : "#041E42";
  const ringColor = inverse ? "rgba(4,30,66,0.28)" : "rgba(255,255,255,0.30)";
  const tickColor = inverse ? "#B03D0C" : "#FF9933";
  const rimColor = inverse ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="BidGuard AI"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={shieldTop} />
          <stop offset="100%" stopColor={shieldBottom} />
        </linearGradient>
        <clipPath id={`${uid}clip`}>
          <path d="M24 2.6 42 9.4v14.4c0 10.9-7.6 18.6-18 22-10.4-3.4-18-11.1-18-22V9.4Z" />
        </clipPath>
      </defs>

      <path
        d="M24 2.6 42 9.4v14.4c0 10.9-7.6 18.6-18 22-10.4-3.4-18-11.1-18-22V9.4Z"
        fill={`url(#${uid})`}
      />

      <g clipPath={`url(#${uid}clip)`}>
        {/* Tricolour base */}
        <rect x="6" y="37.6" width="36" height="3.4" fill="#FF9933" />
        <rect x="6" y="41" width="36" height="3.2" fill="#FFFFFF" opacity="0.94" />
        <rect x="6" y="44.2" width="36" height="3.8" fill="#138808" />
        {/* Chakra reference ring */}
        <circle cx="24" cy="21.5" r="9.2" fill="none" stroke={ringColor} strokeWidth="1.5" />
        {/* Verification tick */}
        <path
          d="M19.2 21.9 22.7 25.4 29.2 18.2"
          fill="none"
          stroke={tickColor}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <path
        d="M24 2.6 42 9.4v14.4c0 10.9-7.6 18.6-18 22-10.4-3.4-18-11.1-18-22V9.4Z"
        fill="none"
        stroke={rimColor}
        strokeWidth="1.2"
      />
    </svg>
  );
}

export default BrandMark;
