"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Target, TriangleAlert } from "lucide-react";
import { DEMO_PERSONAS, setSession, type DemoPersona } from "@/lib/session";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  regional_coordinator: "Regional Coordinator",
  constituency_coordinator: "Constituency Coordinator",
  analyst: "Analyst",
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

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
    // Resolve the user's role + scope from their profile.
    const { data: profile } = await supa
      .from("profiles")
      .select("role, full_name, regions(name), constituencies(name)")
      .eq("user_id", data.user.id)
      .single();

    const role = (profile?.role as string) ?? "analyst";
    const region = (profile as any)?.regions?.name as string | undefined;
    const constituency = (profile as any)?.constituencies?.name as string | undefined;
    const scope = constituency
      ? `${region ?? ""} · ${constituency}`
      : region ?? (role === "super_admin" ? "National" : "National (read-only)");

    setSession({
      key: "supabase",
      name: (profile?.full_name as string) ?? email,
      role: role as DemoPersona["role"],
      roleLabel: ROLE_LABELS[role] ?? "Member",
      scope,
      email: email.trim(),
    });
    router.push("/dashboard");
  }

  function demoSignIn(p: DemoPersona) {
    setSession(p);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-10 sm:px-12 lg:px-20">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 md:hidden">
          <Target size={22} className="text-primary" />
          <span className="text-lg font-semibold text-foreground">GroundGame</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Delegate Mobilization &amp; Call-Tracking — trusted leadership access only.
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
            <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <TriangleAlert size={15} /> {error}
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
            Supabase isn't configured in this environment, so real sign-in is unavailable. Use a demo account below.
          </p>
        )}

        <div className="mt-8 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showDemo ? "Hide" : "Use a"} demo account (no Supabase)
          </button>
          {showDemo && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => demoSignIn(p)}
                  className={cn(
                    "rounded-lg border border-input px-3 py-2 text-left text-sm transition hover:border-primary",
                  )}
                >
                  <div className="font-medium text-foreground">{p.roleLabel}</div>
                  <div className="text-xs text-muted-foreground">{p.scope}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
