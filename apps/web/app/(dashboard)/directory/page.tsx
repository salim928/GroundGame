import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { getRosterCounts, rosterKey } from "@/lib/delegates.server";
import { getViewerScope, scopeHierarchy } from "@/lib/scope.server";
import { PageHeader } from "@/components/primitives";
import { DirectoryBrowser } from "@/components/DirectoryBrowser";

export default async function DirectoryPage() {
  const [counts, scope] = await Promise.all([getRosterCounts(), getViewerScope()]);
  const regions = scopeHierarchy(REAL_HIERARCHY, scope).map((r) => ({
    name: r.name,
    code: r.code,
    constituencies: r.constituencies.map((c) => ({
      id: `c-${c.code}`,
      name: c.name,
      code: c.code,
      delegates: counts[rosterKey(r.name, c.name)] ?? 0,
    })),
  }));
  const stats = regions.reduce(
    (acc, r) => {
      acc.constituencies += r.constituencies.length;
      acc.delegates += r.constituencies.reduce((s, c) => s + c.delegates, 0);
      return acc;
    },
    { constituencies: 0, delegates: 0 },
  );

  return (
    <>
      <PageHeader
        title="Directory"
        subtitle="Every region and constituency. Click a constituency to view and edit its executives."
      />
      <DirectoryBrowser regions={regions} stats={stats} />
    </>
  );
}
