import { TrendingDown } from "lucide-react";
import { data } from "@/lib/data";
import { fmt, pct } from "@/lib/analytics";
import { Card, ClassBadge, Kpi, PageHeader } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";
import { TrendCard } from "@/components/TrendCard";
import { AnalyticsActions } from "@/components/AnalyticsActions";
import { ClassDonut, FunnelBars, RegionBars, SupportDonut } from "@/components/charts";

export default async function AnalyticsPage() {
  const a = await data.analytics();

  return (
    <>
      <PageHeader
        title="Analytics & Reports"
        subtitle="Coverage, support funnel, projection and priority ranking across the campaign"
        action={<AnalyticsActions regions={a.regions} priority={a.priority} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Delegates" value={fmt(a.kpis.delegates)} />
        <Kpi label="Coverage" value={pct(a.kpis.coverage)} sub={`${fmt(a.kpis.called)} called`} />
        <Kpi label="Reach rate" value={pct(a.reachRate)} sub="reached ÷ called" />
        <Kpi label="Support rate" value={pct(a.supportRate)} sub="supportive ÷ reached" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink">Support funnel</h2>
          <FunnelBars data={a.funnel} />
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 text-sm font-medium text-slate-600">National support composition</div>
            <SupportSpine spine={a.spine} height={14} showLegend />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-ink">Support composition</h2>
          <SupportDonut spine={a.spine} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">Coverage vs projected support by region</h2>
          <RegionBars data={a.regions} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Constituency classification</h2>
          <ClassDonut data={a.classDistribution} />
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <TrendingDown size={18} className="text-rose-500" />
          <h2 className="font-semibold text-ink">Priority ranking</h2>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          High-delegate, low-coverage constituencies first — where field effort moves the projection most.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">Constituency</th>
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 font-medium">Delegates</th>
                <th className="py-2 font-medium">Coverage</th>
                <th className="py-2 font-medium">Projected</th>
                <th className="py-2 font-medium">Priority gap</th>
                <th className="py-2 font-medium">Class</th>
              </tr>
            </thead>
            <tbody>
              {a.priority.map((c, i) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
                  <td className="tnum py-2.5 text-slate-400">{i + 1}</td>
                  <td className="py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="py-2.5 text-slate-500">{c.region}</td>
                  <td className="tnum py-2.5 text-slate-600">{c.delegates}</td>
                  <td className="tnum py-2.5 text-slate-600">{pct(c.coverage)}</td>
                  <td className="tnum py-2.5 font-medium text-ink">{pct(c.projected)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-rose-400"
                          style={{ width: pct(Math.min(1, c.gap / (a.priority[0].gap || 1))) }}
                        />
                      </div>
                      <span className="tnum text-xs text-slate-400">{c.gap.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="py-2.5"><ClassBadge value={c.classification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <TrendCard data={a.dailyReached} />
      </div>
    </>
  );
}
