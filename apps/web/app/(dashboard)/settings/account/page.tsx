import { Card, PageHeader } from "@/components/primitives";
import { ChangePassword } from "@/components/ChangePassword";

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" subtitle="Manage your sign-in credentials." />
      <Card className="max-w-md">
        <h2 className="mb-4 font-semibold text-foreground">Change password</h2>
        <ChangePassword />
      </Card>
    </>
  );
}
