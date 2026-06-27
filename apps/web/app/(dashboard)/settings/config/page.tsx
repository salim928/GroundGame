import { PageHeader } from "@/components/primitives";
import { ConfigForm } from "@/components/ConfigForm";

export default function CampaignSettingsPage() {
  return (
    <>
      <PageHeader
        title="Campaign settings"
        subtitle="Targets, projection weights and classification thresholds. Changes apply across the dashboard without a redeploy."
      />
      <ConfigForm />
    </>
  );
}
