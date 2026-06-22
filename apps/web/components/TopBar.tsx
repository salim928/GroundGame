"use client";

import { useEffect, useState } from "react";
import { getSession, type DemoPersona } from "@/lib/session";

export function TopBar() {
  const [persona, setPersona] = useState<DemoPersona | null>(null);
  useEffect(() => setPersona(getSession()), []);

  const initials =
    persona?.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "GG";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight text-foreground">{persona?.name ?? "GroundGame"}</div>
          <div className="text-xs text-muted-foreground">{persona ? `${persona.roleLabel} · ${persona.scope}` : ""}</div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          title={persona?.name ?? ""}
        >
          {initials.toUpperCase()}
        </div>
      </div>
    </header>
  );
}
