"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Target } from "lucide-react";
import { DEMO_PERSONAS, setSession, type DemoPersona } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const [persona, setPersona] = useState<DemoPersona>(DEMO_PERSONAS[0]);
  const [loading, setLoading] = useState(false);

  function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setSession(persona);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-10 sm:px-12 lg:px-20">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 md:hidden">
          <Target size={22} className="text-primary" />
          <span className="text-lg font-semibold text-foreground">GroundGame</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Delegate Mobilization &amp; Call-Tracking — trusted leadership access only.
        </p>

        <form onSubmit={signIn} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" key={persona.email} defaultValue={persona.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" defaultValue="demo1234" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <ArrowRight />}
          </Button>
        </form>

        <div className="mt-8">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck size={14} /> Demo access — explore as
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_PERSONAS.map((p) => {
              const active = p.key === persona.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPersona(p)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-muted-foreground/40",
                  )}
                >
                  <div className="font-medium text-foreground">{p.roleLabel}</div>
                  <div className="text-xs text-muted-foreground">{p.scope}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No password needed for the demo — pick a role and sign in. Production uses Supabase Auth.
          </p>
        </div>
      </div>
    </div>
  );
}
