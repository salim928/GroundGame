import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { getRealDelegateCount, rosterStats } from "@/lib/delegates.server";
import { PageHeader } from "@/components/primitives";
import { DirectoryBrowser } from "@/components/DirectoryBrowser";

export default function DirectoryPage() {
  const regions = REAL_HIERARCHY.map((r) => ({
    name: r.name,
    code: r.code,
    constituencies: r.constituencies.map((c) => ({
      id: `c-${c.code}`,
      name: c.name,
      code: c.code,
      delegates: getRealDelegateCount(r.name, c.name),
    })),
  }));
  const stats = rosterStats();

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
