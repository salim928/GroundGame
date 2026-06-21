"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  BarChart3,
  PhoneCall,
  AlertTriangle,
  Upload,
  Users,
  ChevronLeft,
  Target,
  Menu,
  LogOut,
  RefreshCw,
  FolderTree,
} from "lucide-react";
import { clearSession, getSession, type DemoPersona } from "@/lib/session";
import { canAccess } from "@/lib/access";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Campaign" },
  { href: "/regions", label: "Regions", icon: Map, section: "Campaign" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, section: "Campaign" },
  { href: "/directory", label: "Directory", icon: FolderTree, section: "Data" },
  { href: "/callers", label: "Callers", icon: PhoneCall, section: "Data" },
  { href: "/operations", label: "Field Ops", icon: RefreshCw, section: "Data" },
  { href: "/conflicts", label: "Review queue", icon: AlertTriangle, section: "Data" },
  { href: "/upload", label: "Import list", icon: Upload, section: "Manage" },
  { href: "/settings/team", label: "Team & roles", icon: Users, section: "Manage" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [persona, setPersona] = useState<DemoPersona | null>(null);

  useEffect(() => {
    setPersona(getSession());
  }, []);

  async function signOut() {
    clearSession();
    try {
      const { getSupabase } = await import("@/lib/supabase");
      await getSupabase()?.auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
  }

  // Only show nav entries this role may actually open (strict access).
  const items = persona ? NAV.filter((it) => canAccess(persona.role, it.href)) : NAV;

  const width = collapsed ? "w-16" : "w-60";

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/40 bg-ink px-4 py-3 text-white md:hidden">
        <button onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 font-semibold">
          <Target size={18} className="text-accent" /> GroundGame
        </span>
      </div>

      <aside
        className={`${width} ${
          mobileOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"
        } shrink-0 flex-col bg-ink text-slate-300 transition-all md:sticky md:top-0 md:flex md:h-screen`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
              <Target size={20} className="text-primary" />
              GroundGame
            </Link>
          )}
          {collapsed && <Target size={20} className="mx-auto text-primary" />}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded p-1 hover:bg-white/10 md:block"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} className={collapsed ? "rotate-180" : ""} />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-2">
          {items.map((item, i) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const showHeader = !collapsed && item.section !== items[i - 1]?.section;
            return (
              <div key={item.href}>
                {showHeader && (
                  <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {item.section}
                  </div>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  {!collapsed && item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="border-t border-white/10 px-4 py-3">
            <div className="text-xs text-slate-500">
              <div className="font-medium text-slate-300">{persona?.name ?? "Demo User"}</div>
              {persona ? `${persona.roleLabel} · ${persona.scope}` : "Super Admin · National"}
            </div>
            <button
              onClick={signOut}
              className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
        {collapsed && (
          <button
            onClick={signOut}
            className="mb-3 flex justify-center text-slate-400 hover:text-white"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
