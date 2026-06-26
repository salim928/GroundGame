import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { ConflictQueue } from "@/components/ConflictQueue";

export default async function ConflictsPage() {
  const conflicts = await data.conflicts();
  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Potential duplicate delegates in your area — same phone number or identical name. Open the constituency to deactivate the extra entry."
      />
      <ConflictQueue initial={conflicts} />
    </>
  );
}
