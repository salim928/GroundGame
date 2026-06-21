import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { rosterStats } from "@/lib/delegates.server";
import { PageHeader } from "@/components/primitives";
import { UploadFlow } from "@/components/UploadFlow";

export default async function UploadPage() {
  const stats = await rosterStats();
  return (
    <>
      <PageHeader
        title="Import list"
        subtitle="Upload the master Excel/CSV grouped region → constituency → branch → delegate"
      />
      <UploadFlow current={{ regions: REAL_HIERARCHY.length, constituencies: stats.constituencies, delegates: stats.delegates }} />
    </>
  );
}
