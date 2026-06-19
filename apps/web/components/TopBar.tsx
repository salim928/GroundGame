"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { getSession, type DemoPersona } from "@/lib/session";

export function TopBar({ conflictsCount, lastSyncMins }: { conflictsCount: number; lastSyncMins: number }) {
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
      <div className="relative hidden flex-1 sm:block sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search regions, constituencies, delegates…"
          className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Live sync status */}
        <span className="hidden items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 sm:inline-flex">
          <RefreshCw size={12} className="text-brand-600" />
          Synced {lastSyncMins}m ago
        </span>

        {/* Conflicts */}
        <Link
          href="/conflicts"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition hover:bg-muted"
          title={`${conflictsCount} open conflicts`}
        >
          <TriangleAlert size={16} />
          {conflictsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {conflictsCount}
            </span>
          )}
        </Link>

        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition hover:bg-muted"
          title="Notifications"
        >
          <Bell size={16} />
        </button>

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
