import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";
import { CircleCheck } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   AuthPanel — the navy brand panel shown beside every authentication form.
   Carries the emblem, the value proposition and the SIH credit so the
   sign-in screens read as part of the government portal, not a generic app.
   ───────────────────────────────────────────────────────────────────────── */

export default function AuthPanel({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points: string[];
}) {
  return (
    <div className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden bg-[var(--navy-900)] p-11">
      <Image
        src="/images/photos/north-block.webp"
        alt=""
        fill
        priority
        sizes="(max-width:1024px) 0px, 46vw"
        className="object-cover opacity-25"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--navy-950)]/92 via-[var(--navy-900)]/85 to-[var(--navy-800)]/80" />

      <div className="relative on-dark">
        <div className="flex flex-col gap-3">
          <BrandLogo size="lg" tone="inverse" href={null} />
          <div className="text-[11px] text-white/65 leading-tight">
            Bid Compliance Platform
          </div>
        </div>
      </div>

      <div className="relative on-dark">
        <h2 className="text-[27px] font-extrabold text-white leading-tight mb-3 max-w-md">
          {title}
        </h2>
        <div className="section-rule mb-4" />
        <p className="text-[14.5px] text-white/70 leading-relaxed max-w-md mb-8">{subtitle}</p>

        <ul className="space-y-3.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[13.5px] text-white/75">
              <CircleCheck className="w-[18px] h-[18px] text-[var(--green-500)] shrink-0 mt-0.5" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative on-dark">
        <div className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-white/12 bg-white/[0.05] p-4">
          <Image
            src="/images/govt/sih-logo.png"
            alt="Smart India Hackathon 2026"
            width={96}
            height={49}
            className="h-10 w-auto shrink-0"
            style={{ height: 40, width: "auto" }}
          />
          <p className="text-[11.5px] text-white/55 leading-relaxed">
            Built for Smart India Hackathon 2026
            <br />
            Team Anveshak 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
