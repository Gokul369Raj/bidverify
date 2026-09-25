import { BrandMark } from "@/components/BrandMark";

/* ─────────────────────────────────────────────────────────────────────────
   Wordmark — brand mark + "BidGuard AI" + descriptor line.
   ───────────────────────────────────────────────────────────────────────── */

export function BrandLogo({
  size = "md",
  tone = "solid",
  href = "/",
  descriptor = "Bid Compliance Platform",
}: {
  size?: "sm" | "md" | "lg";
  tone?: "solid" | "inverse";
  href?: string | null;
  descriptor?: string | null;
}) {
  const markSize = size === "sm" ? 30 : size === "lg" ? 52 : 40;
  const title = size === "sm" ? "text-[15px]" : size === "lg" ? "text-[24px]" : "text-[19px]";
  const sub = size === "sm" ? "text-[9px]" : size === "lg" ? "text-[11.5px]" : "text-[10px]";

  const titleColor = tone === "inverse" ? "text-white" : "text-[var(--navy-800)]";
  const subColor = tone === "inverse" ? "text-white/60" : "text-[var(--foreground-tertiary)]";
  const rule = tone === "inverse" ? "border-white/20" : "border-[var(--border)]";

  const inner = (
    <span className="flex items-center gap-2.5">
      <BrandMark size={markSize} tone={tone} />
      <span className={`flex flex-col border-l pl-2.5 ${rule}`}>
        <span className={`font-extrabold leading-none tracking-tight ${title} ${titleColor}`}>
          BidGuard<span className="text-[var(--saffron-500)]"> AI</span>
        </span>
        {descriptor && (
          <span className={`${sub} leading-tight font-medium mt-1 ${subColor}`}>
            {descriptor}
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <a href={href} className="shrink-0" aria-label="BidGuard AI — home">
      {inner}
    </a>
  );
}

export default BrandLogo;
