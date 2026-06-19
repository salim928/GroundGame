import { data } from "@/lib/data";
import { PageHeader } from "@/components/primitives";
import { ProjectionPanel } from "@/components/ProjectionPanel";

export default async function ProjectionPage() {
  const p = await data.projection();
  return (
    <>
      <PageHeader
        title="Projection"
        subtitle="Weighted projection with scenario modelling — weights are campaign configuration, not hard-coded"
      />
      <ProjectionPanel payload={p} />
    </>
  );
}
