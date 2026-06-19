import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { CallersBoard } from "@/components/CallersBoard";

export default async function CallersPage() {
  const callers = await data.callers();
  return (
    <>
      <PageHeader title="Callers" subtitle="Performance leaderboard — filter by region and export" />
      <CallersBoard callers={callers} />
    </>
  );
}
