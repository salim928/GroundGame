"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Loader2, Target, TriangleAlert } from "lucide-react";
import { DEMO_PERSONAS, setSession, type DemoPersona } from "@/lib/session";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/access";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Per-role accent for the portal badge — makes each login page visibly distinct.
const ROLE_TONE: Record<Role, string> = {
  super_admin: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  regional_coordinator: "bg-blue-100 text-blue-800 ring-blue-200",
  constituency_coordinator: "bg-amber-100 text-amber-800 ring-amber-200",
  analyst: "bg-slate-200 text-slate-700 ring-slate-300",
  caller: "bg-violet-100 text-violet-800 ring-violet-200",
};

const ROLE_HINT: Record<Role, string> = {
  super_admin: "Full national access to every region, import and team controls.",
  regional_coordinator: "Manage and track delegates across your assigned region.",
  constituency_coordinator: "Track and coordinate calling for your constituency.",
  analyst: "Read-only analytics and projections across the campaign.",
  caller: "Sign in to call and log outcomes for your assigned constituency.",
};

export function LoginForm({ expectedRole }: { expectedRole?: Role }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const demoPersona =
    expectedRole && expectedRole !== "caller"
      ? DEMO_PERSONAS.find((p) => p.role === expectedRole)
      : undefined;

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supa = getSupabase();
    if (!supa) {
      setError("Sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.");
      return;
    }
    setLoading(true);
    const { data, error: authErr } = await supa.auth.signInWithPassword({ email: email.trim(), password });
    if (authErr || !data.user) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    // Resolve the user's real role + scope from their profile.
    const { data: profile } = await supa
      .from("profiles")
      .select("role, full_name, regions(name,code), constituencies(name,code)")
      .eq("user_id", data.user.id)
      .single();

    const role = ((profile?.role as Role) ?? "analyst") as Role;

    // Strict portal check: you can only enter through your own role's door.
    if (expectedRole && role !== expectedRole) {
      await supa.auth.signOut();
      setError(
        `This is the ${ROLE_LABEL[expectedRole]} portal, but your account is a ${ROLE_LABEL[role]}. Please use the ${ROLE_LABEL[role]} portal.`,
      );
      setLoading(false);
      return;
    }

    const region = (profile as any)?.regions?.name as string | undefined;
    const constituency = (profile as any)?.constituencies?.name as string | undefined;
    const regionCode = (profile as any)?.regions?.code as string | undefined;
    const conCode = (profile as any)?.constituencies?.code as string | undefined;
    const scope = constituency
      ? `${region ?? ""} · ${constituency}`
      : region ?? (role === "super_admin" ? "National" : "National (read-only)");

    setSession({
      key: "supabase",
      name: (profile?.full_name as string) ?? email,
      role,
      roleLabel: ROLE_LABEL[role],
      scope,
      email: email.trim(),
      regionCode: regionCode ?? null,
      conCode: conCode ?? null,
    });
    router.push(ROLE_HOME[role]);
  }

  function demoSignIn(p: DemoPersona) {
    setSession(p);
    router.push(ROLE_HOME[p.role]);
  }

  const heading = expectedRole ? `${ROLE_LABEL[expectedRole]} sign-in` : "Sign in";

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-10 sm:px-12 lg:px-20">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 md:hidden">
          <Target size={22} className="text-primary" />
          <span className="text-lg font-semibold text-foreground">GroundGame</span>
        </div>

        {expectedRole && (
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} /> Choose a different role
          </Link>
        )}

        {expectedRole && (
          <span
            className={`mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${ROLE_TONE[expectedRole]}`}
          >
            {ROLE_LABEL[expectedRole]} portal
          </span>
        )}

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {expectedRole ? ROLE_HINT[expectedRole] : "Delegate Mobilization & Call-Tracking — trusted access only."}
        </p>

        <form onSubmit={signIn} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@groundgame.gh"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight />
              </>
            )}
          </Button>
        </form>

        {!supabaseConfigured && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase isn't configured here, so real sign-in is unavailable.
            {demoPersona ? " Use the demo button below." : ""}
          </p>
        )}

        {demoPersona && (
          <div className="mt-8 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => demoSignIn(demoPersona)}
              className="w-full rounded-lg border border-input px-3 py-2.5 text-left text-sm transition hover:border-primary"
            >
              <div className="font-medium text-foreground">Explore as a demo {ROLE_LABEL[demoPersona.role]}</div>
              <div className="text-xs text-muted-foreground">No Supabase — {demoPersona.scope}</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
