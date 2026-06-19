import { PageHeader } from "@/components/primitives";
import { UploadFlow } from "@/components/UploadFlow";

export default function UploadPage() {
  return (
    <>
      <PageHeader
        title="Import list"
        subtitle="Upload the master Excel/CSV grouped region → constituency → branch → delegate"
      />
      <UploadFlow />
    </>
  );
}
