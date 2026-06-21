import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { CallersBoard } from "@/components/CallersBoard";
import { CallerManager } from "@/components/CallerManager";

export default async function CallersPage() {
  const callers = await data.callers();
  return (
    <>
      <PageHeader title="Callers" subtitle="Create scoped caller logins, track assignments, and review performance" />
      <CallerManager />
      <CallersBoard callers={callers} />
    </>
  );
}
