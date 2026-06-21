import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { data } from "@/lib/data";
import { fmt, pct } from "@/lib/analytics";
import { Card, ClassBadge, Kpi, PageHeader } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";
import { ReachedChart } from "@/components/ReachedChart";
import { FunnelBars, SupportDonut } from "@/components/charts";
import { FieldOps, PaceCard } from "@/components/FieldOps";

const SEV_ICON = { info: Info, warn: AlertTriangle, critical: OctagonAlert };
const SEV_COLOR = { info: "text-sky-500", warn: "text-amber-500", critical: "text-rose-500" };

export default async function OverviewPage() {
  const o = await data.overview();
  const funnel = [
    { stage: "Delegates", value: o.kpis.delegates },
    { stage: "Called", value: o.kpis.called },
    { stage: "Reached", value: o.kpis.reached },
    { stage: "Supportive", value: o.spine.supportive },
  ];

  return (
    <>
      <PageHeader
        title="National Overview"
        subtitle="Delegate outreach across all regions · updated continuously from the field"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Delegates" value={fmt(o.kpis.delegates)} sub="across all constituencies" />
        <Kpi label="Coverage" value={pct(o.kpis.coverage)} sub={`${fmt(o.kpis.called)} called`} delta={o.trends.coverage} />
        <Kpi
          label="Reached"
          value={fmt(o.kpis.reached)}
          sub={pct(o.kpis.reached / o.kpis.delegates) + " of delegates"}
          delta={o.trends.reached}
        />
        <Kpi label="Supportive" value={fmt(o.spine.supportive)} sub="reached & supportive" accent />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">National support spine</h2>
            <span className="text-xs text-muted-foreground">Supportive · Undecided · Opposed · Not reached</span>
          </div>
          <SupportSpine spine={o.spine} height={16} showLegend />
          <div className="mb-2 mt-6 text-sm font-medium text-muted-foreground">Reached per day (14d)</div>
          <ReachedChart data={o.dailyReached} />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-foreground">Alerts</h2>
          <ul className="space-y-3">
            {o.alerts.map((a) => {
              const Icon = SEV_ICON[a.severity];
              return (
                <li key={a.id} className="flex gap-3">
                  <Icon size={16} className={`mt-0.5 shrink-0 ${SEV_COLOR[a.severity]}`} />
                  <div>
                    <p className="text-sm text-foreground">{a.message}</p>
                    {a.scope && <p className="text-xs text-muted-foreground">{a.scope}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PaceCard pace={o.paceToTarget} />
        <FieldOps sync={o.syncHealth} />
        <Card>
          <h2 className="mb-2 font-semibold text-foreground">Support composition</h2>
          <SupportDonut spine={o.spine} />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 font-semibold text-foreground">Support funnel</h2>
        <FunnelBars data={funnel} />
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Regions</h2>
          <Link href="/regions" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 font-medium">Constit.</th>
                <th className="py-2 font-medium">Coverage</th>
                <th className="py-2 font-medium">Class</th>
                <th className="w-56 py-2 font-medium">Support spine</th>
              </tr>
            </thead>
            <tbody>
              {o.regions.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
                  <td className="py-2.5">
                    <Link href={`/regions/${r.id}`} className="font-medium text-foreground hover:text-primary">
                      {r.name}
                    </Link>
                  </td>
                  <td className="tnum py-2.5 text-muted-foreground">{r.constituencies}</td>
                  <td className="tnum py-2.5 text-muted-foreground">{pct(r.kpis.coverage)}</td>
                  <td className="py-2.5"><ClassBadge value={r.classification} /></td>
                  <td className="py-2.5"><SupportSpine spine={r.spine} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-4 font-semibold text-foreground">Executive engagement</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {o.segments.map((s) => (
            <div key={s.segment}>
              <div className="kpi-label">{s.label}</div>
              <div className="tnum mt-1 text-2xl font-semibold text-foreground">{pct(s.reached / s.total)}</div>
              <div className="text-xs text-muted-foreground">
                {fmt(s.reached)} / {fmt(s.total)} reached
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: pct(s.reached / s.total) }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
