import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, UserX } from "lucide-react";
import { data } from "@/lib/data";
import { fmt, pct } from "@/lib/analytics";
import { Card, ClassBadge, Kpi, PageHeader, Pill } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";

const STATUS: Record<string, { tone: "green" | "amber" | "red"; label: string }> = {
  ok: { tone: "green", label: "On track" },
  behind: { tone: "amber", label: "Behind" },
  no_callers: { tone: "red", label: "No callers" },
};

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await data.region(id);
  if (!payload) notFound();
  const { region, constituencies, segments } = payload;

  return (
    <>
      <PageHeader
        title={region.name}
        subtitle={`${region.code} · ${region.constituencies} constituencies`}
        action={<ClassBadge value={region.classification} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Delegates" value={fmt(region.kpis.delegates)} />
        <Kpi label="Coverage" value={pct(region.kpis.coverage)} sub={`${fmt(region.kpis.called)} called`} />
        <Kpi label="Reached" value={fmt(region.kpis.reached)} />
        <Kpi label="Projected support" value={pct(region.kpis.projectedSupport)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">Region support spine</h2>
          <SupportSpine spine={region.spine} height={16} showLegend />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Executive engagement</h2>
          <ul className="space-y-2.5">
            {segments.map((s) => (
              <li key={s.segment} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{s.label}</span>
                <span className="tnum font-medium text-ink">{pct(s.reached / s.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold text-ink">Constituency league table</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">Constituency</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Coverage</th>
                <th className="py-2 font-medium">Callers / target</th>
                <th className="py-2 font-medium">Projected</th>
                <th className="py-2 font-medium">Class</th>
                <th className="w-48 py-2 font-medium">Spine</th>
              </tr>
            </thead>
            <tbody>
              {constituencies.map((c) => {
                const st = STATUS[c.status];
                return (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
                    <td className="py-2.5">
                      <Link href={`/constituencies/${c.id}`} className="font-medium text-ink hover:text-accent">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Pill tone={st.tone}>
                        {c.status === "no_callers" && <UserX size={12} className="mr-1 inline" />}
                        {c.status === "behind" && <AlertCircle size={12} className="mr-1 inline" />}
                        {st.label}
                      </Pill>
                    </td>
                    <td className="tnum py-2.5 text-slate-600">{pct(c.kpis.coverage)}</td>
                    <td className="tnum py-2.5 text-slate-600">
                      {c.callersAssigned} / {c.targetContacts}
                    </td>
                    <td className="tnum py-2.5 font-medium text-ink">{pct(c.kpis.projectedSupport)}</td>
                    <td className="py-2.5"><ClassBadge value={c.classification} /></td>
                    <td className="py-2.5"><SupportSpine spine={c.spine} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
