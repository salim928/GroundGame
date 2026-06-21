import Link from "next/link";
import { ArrowRight, BarChart3, Map, MapPin, PhoneCall, Shield, Target } from "lucide-react";
import type { Role } from "@/lib/types";
import { ROLE_LABEL, ROLE_SLUG } from "@/lib/access";

const CHOICES: { role: Role; icon: typeof Shield; desc: string; tone: string }[] = [
  { role: "super_admin", icon: Shield, desc: "National command — every region, imports & team", tone: "text-emerald-600" },
  { role: "regional_coordinator", icon: Map, desc: "Coordinate delegates across your region", tone: "text-blue-600" },
  { role: "constituency_coordinator", icon: MapPin, desc: "Run calling for your constituency", tone: "text-amber-600" },
  { role: "caller", icon: PhoneCall, desc: "Call and log outcomes for your constituency", tone: "text-violet-600" },
  { role: "analyst", icon: BarChart3, desc: "Read-only analytics and projections", tone: "text-slate-600" },
];

export function RoleChooser() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-10 sm:px-12 lg:px-20">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 md:hidden">
          <Target size={22} className="text-primary" />
          <span className="text-lg font-semibold text-foreground">GroundGame</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to GroundGame</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Choose your access level to continue.</p>

        <div className="mt-8 space-y-2.5">
          {CHOICES.map(({ role, icon: Icon, desc, tone }) => (
            <Link
              key={role}
              href={`/login/${ROLE_SLUG[role]}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition hover:border-primary hover:shadow-sm"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${tone}`}>
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{ROLE_LABEL[role]}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
              <ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
