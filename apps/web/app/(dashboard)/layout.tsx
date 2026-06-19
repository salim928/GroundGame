import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { RequireAuth } from "@/components/RequireAuth";
import { data, usingMock } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const conflicts = await data.conflicts();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar conflictsCount={conflicts.length} lastSyncMins={4} />
        {usingMock && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200/60 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Demo mode — serving the typed mock data layer. Set <code className="font-mono">NEXT_PUBLIC_USE_MOCK=false</code> to use the live API.
          </div>
        )}
        <div className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6">
          <RequireAuth>{children}</RequireAuth>
        </div>
      </main>
    </div>
  );
}
