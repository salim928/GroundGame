import { Target, Settings, TrendingUp } from "lucide-react";

// NDC "Operations Excellence" creative, recreated as a responsive panel.
// To use the original raster instead, drop the file at apps/web/public/landing.png
// and set NEXT_PUBLIC_USE_LANDING_IMAGE=true.
const USE_IMAGE = process.env.NEXT_PUBLIC_USE_LANDING_IMAGE === "true";

const PILLARS = [
  { icon: Target, label: "Strategic Execution" },
  { icon: Settings, label: "Operational Efficiency" },
  { icon: TrendingUp, label: "Impact & Accountability" },
];

function UmbrellaMark({ className = "" }: { className?: string }) {
  // NDC umbrella roundel (red / white / green / black).
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="30" r="22" fill="#fff" />
      <path d="M12 30a20 20 0 0 1 40 0Z" fill="#0a7d34" />
      <path d="M12 30a20 20 0 0 1 20-20v20Z" fill="#ce1126" />
      <path d="M32 10a20 20 0 0 1 20 20H32Z" fill="#111" />
      <rect x="30.5" y="29" width="3" height="20" rx="1.5" fill="#111" />
      <path d="M33.5 47a4 4 0 0 0 6 0" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BrandPanel() {
  if (USE_IMAGE) {
    return (
      <div className="relative hidden md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing.png" alt="NDC — Operations Excellence" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 md:flex md:flex-col md:justify-between md:p-12 lg:p-16">
      {/* faint umbrella watermark */}
      <UmbrellaMark className="pointer-events-none absolute -right-10 top-16 h-72 w-72 opacity-[0.06]" />

      <div>
        {/* Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-5xl font-extrabold tracking-tight text-white">ND</span>
          <UmbrellaMark className="h-12 w-12" />
        </div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
          National Democratic Congress
        </div>
        <div className="mt-3 h-1 w-44 rounded-full bg-gradient-to-r from-[#ce1126] via-white to-[#0a7d34]" />
        <div className="mt-2 text-xs font-medium uppercase tracking-[0.25em] text-emerald-200/90">
          Inspire • Empower • Transform
        </div>
      </div>

      <div className="my-10">
        <h1 className="text-5xl font-extrabold leading-[1.05] text-white lg:text-6xl">
          Operations
          <br />
          Excellence
        </h1>
        <p className="mt-5 text-lg text-white/85">
          Driven by <span className="font-semibold text-emerald-300">Service</span>.
          <br />
          Powered by <span className="font-semibold text-emerald-300">Purpose</span>.
        </p>

        <ul className="mt-9 space-y-4">
          {PILLARS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-900/40">
                <Icon size={18} />
              </span>
              <span className="text-lg font-semibold text-white">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between text-white/70">
        <span className="text-sm">ndcgh.org</span>
        <span className="text-base font-bold tracking-tight text-white">#StrongerTogether</span>
      </div>
    </div>
  );
}
