import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { SyncRuns } from "@/components/SyncRuns";

export default async function OperationsPage() {
  const overview = await data.syncOverview();
  return (
    <>
      <PageHeader
        title="Field Operations"
        subtitle="Sheet sync health and run history. The worker pulls every 15 minutes; Super Admin can force a sync."
      />
      <SyncRuns overview={overview} />
    </>
  );
}
