import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { ConflictQueue } from "@/components/ConflictQueue";

export default async function ConflictsPage() {
  const conflicts = await data.conflicts();
  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Two mutually-exclusive outcomes were ticked. The sync never guesses — set the true outcome here."
      />
      <ConflictQueue initial={conflicts} />
    </>
  );
}
