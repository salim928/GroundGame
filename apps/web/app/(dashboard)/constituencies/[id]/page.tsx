import { notFound } from "next/navigation";
import { Phone, Users } from "lucide-react";
import { data } from "@/lib/data";
import { fmt, pct } from "@/lib/analytics";
import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { getRealDelegates, getDelegateCalls } from "@/lib/delegates.server";
import { Card, ClassBadge, Kpi, PageHeader } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";
import { DelegateRoster } from "@/components/DelegateRoster";
import { BackButton } from "@/components/BackButton";

export default async function ConstituencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await data.constituency(id);
  if (!payload) notFound();
  const { constituency: c, branches, callbacks, callers } = payload;
  const reachedPct = c.kpis.delegates ? c.kpis.reached / c.kpis.delegates : 0;
  const regionName = REAL_HIERARCHY.find((r) => `r-${r.code}` === c.regionId)?.name ?? "";
  const realDelegates = await getRealDelegates(regionName, c.name);
  const callMap = await getDelegateCalls(realDelegates.map((d) => d.id).filter(Boolean) as string[]);

  return (
    <>
      <BackButton fallback={`/regions/${c.regionId}`} label={regionName ? `Back to ${regionName}` : "Back"} />
      <PageHeader
        title={c.name}
        subtitle={`${c.code} · target ${c.targetContacts} active contacts`}
        action={<ClassBadge value={c.classification} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Delegates" value={fmt(c.kpis.delegates)} />
        <Kpi label="Coverage" value={pct(c.kpis.coverage)} sub={`${fmt(c.kpis.called)} called`} />
        <Kpi label="Reached" value={pct(reachedPct)} sub={`${fmt(c.kpis.reached)} delegates`} />
        <Kpi label="Supportive" value={fmt(c.spine.supportive)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">Support readout</h2>
          <SupportSpine spine={c.spine} height={16} showLegend />

          <h3 className="mb-2 mt-6 text-sm font-medium text-slate-600">Branch breakdown</h3>
          <div className="space-y-2">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-sm text-ink">{b.name}</div>
                <div className="flex-1"><SupportSpine spine={b.spine} /></div>
                <div className="tnum w-20 shrink-0 text-right text-xs text-slate-400">
                  {b.called}/{b.delegates}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold text-ink">10-caller target</h2>
            <div className="flex items-end gap-2">
              <span className="tnum text-3xl font-semibold text-ink">{c.callersAssigned}</span>
              <span className="mb-1 text-sm text-slate-400">/ {c.targetContacts} assigned</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-accent"
                style={{ width: pct(Math.min(1, c.callersAssigned / c.targetContacts)) }}
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-ink">Callbacks due</h2>
            {callbacks.length === 0 ? (
              <p className="text-sm text-slate-400">None scheduled.</p>
            ) : (
              <ul className="space-y-2.5">
                {callbacks.map((cb) => (
                  <li key={cb.delegateId} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-ink">{cb.name}</div>
                      <div className="text-xs text-slate-400">
                        {cb.branch} · {cb.caller}
                      </div>
                    </div>
                    <span className="tnum text-xs text-slate-500">{cb.callbackAt}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold text-ink">Caller board</h2>
        {callers.length === 0 ? (
          <p className="text-sm text-slate-400">No callers assigned to this constituency yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {callers.map((caller) => (
              <div key={caller.label} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <Phone size={14} className="text-accent" /> {caller.label}
                </div>
                <div className="tnum mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                  <div>
                    <div className="font-semibold text-ink">{caller.attempts}</div>
                    <div className="text-slate-400">att.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-ink">{caller.reached}</div>
                    <div className="text-slate-400">reached</div>
                  </div>
                  <div>
                    <div className="font-semibold text-ink">{caller.assigned}</div>
                    <div className="text-slate-400">assigned</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">Active {caller.lastActive}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {realDelegates.length > 0 && (
        <div className="mt-4">
          <DelegateRoster constituency={c.name} constituencyCode={c.code} initial={realDelegates} calls={callMap} />
        </div>
      )}

      {realDelegates.length === 0 && (
        <Card className="mt-4">
          <div className="flex flex-col items-center py-12 text-center">
            <Users className="mb-3 text-slate-300" size={32} />
            <p className="font-medium text-ink">Roster not yet available</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              The delegate list for this constituency hasn&apos;t been loaded yet. Once it&apos;s added, the executives
              and their call status will appear here.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
