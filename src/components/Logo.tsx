"use client";

export function Logo({ size = "default", white = false, dark = false }: { size?: "small" | "default" | "large"; white?: boolean; dark?: boolean }) {
  const s = size === "small" ? 28 : size === "large" ? 48 : 34;
  const textSize = size === "small" ? "text-[15px]" : size === "large" ? "text-2xl" : "text-lg";
  const subSize = size === "small" ? "text-[8px]" : size === "large" ? "text-[11px]" : "text-[9px]";

  return (
    <div className="flex items-center gap-2.5">
      {/* Shield + Tick Mark Logo */}
      <div className={`relative shrink-0 rounded-xl flex items-center justify-center ${white ? "bg-white/10" : dark ? "bg-[var(--accent)]" : "bg-gradient-to-b from-[#2997ff] to-[#0066cc]"}`} style={{ width: s, height: s }}>
        <svg width={s * 0.58} height={s * 0.58} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 7V12C3 17.25 7.25 21.5 12 22.75C16.75 21.5 21 17.25 21 12V7L12 2Z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="leading-none">
        <div className={`font-semibold tracking-[-0.02em] ${textSize} ${white ? "text-white/90" : dark ? "text-[var(--foreground)]" : "text-white"}`}>
          BIDGUARD AI
        </div>
        {size !== "small" && (
          <div className={`${subSize} mt-1 ${white ? "text-white/50" : dark ? "text-[var(--foreground-tertiary)]" : "text-[#86868b]"} tracking-wide`}>
            BID COMPLIANCE PLATFORM
          </div>
        )}
      </div>
    </div>
  );
}

export function GovtEmblem({ white = false }: { white?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={white ? "opacity-80" : "opacity-60"}>
      <circle cx="12" cy="12" r="11" stroke={white ? "white" : "#86868b"} strokeWidth="1" fill="none" />
      <path d="M12 3L14.5 8H18L12 21L6 8H9.5L12 3Z" fill="rgba(41,151,255,0.2)" stroke="#2997ff" strokeWidth="0.75" />
    </svg>
  );
}
