import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { TeamManager } from "@/components/TeamManager";

export default async function TeamPage() {
  const members = await data.members();
  return (
    <>
      <PageHeader
        title="Team & roles"
        subtitle="Dashboard members and their scope. Create a member and assign a region or constituency. Field callers have no login."
      />
      <TeamManager initial={members} />
    </>
  );
}
