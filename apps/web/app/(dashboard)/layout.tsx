import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { RequireAuth } from "@/components/RequireAuth";
import { data } from "@/lib/data";
import { rosterStats } from "@/lib/delegates.server";

// Dashboard pages depend on runtime env + Supabase, so render per request
// (not statically baked at build time).
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const conflicts = await data.conflicts();
  const roster = await rosterStats();
  const noData = roster.constituencies === 0;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar conflictsCount={conflicts.length} lastSyncMins={4} />
        {noData && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200/60 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            No delegate roster loaded yet — seed Supabase (see README) to populate the directory.
          </div>
        )}
        <div className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6">
          <RequireAuth>{children}</RequireAuth>
        </div>
      </main>
    </div>
  );
}
