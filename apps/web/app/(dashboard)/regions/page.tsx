import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { data } from "@/lib/data";
import { fmt, pct } from "@/lib/analytics";
import { Card, ClassBadge, PageHeader } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";

export default async function RegionsPage() {
  const regions = await data.regions();

  return (
    <>
      <PageHeader title="Regions" subtitle="Coverage and support by region" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => (
          <Link key={r.id} href={`/regions/${r.id}`}>
            <Card className="transition hover:border-accent/40 hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-ink">{r.name}</div>
                  <div className="text-xs text-slate-400">
                    {r.code} · {r.constituencies} constituencies
                  </div>
                </div>
                <ClassBadge value={r.classification} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="tnum text-lg font-semibold text-ink">{fmt(r.kpis.delegates)}</div>
                  <div className="kpi-label">Delegates</div>
                </div>
                <div>
                  <div className="tnum text-lg font-semibold text-ink">{pct(r.kpis.coverage)}</div>
                  <div className="kpi-label">Coverage</div>
                </div>
                <div>
                  <div className="tnum text-lg font-semibold text-ink">{pct(r.kpis.projectedSupport)}</div>
                  <div className="kpi-label">Projected</div>
                </div>
              </div>
              <div className="mt-4">
                <SupportSpine spine={r.spine} />
              </div>
              <div className="mt-3 flex items-center justify-end text-sm font-medium text-accent">
                Open region <ChevronRight size={16} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
