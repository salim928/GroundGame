import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { RequireAuth } from "@/components/RequireAuth";

// Dashboard pages depend on runtime env + Supabase, so render per request
// (not statically baked at build time).
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6">
          <RequireAuth>{children}</RequireAuth>
        </div>
      </main>
    </div>
  );
}
