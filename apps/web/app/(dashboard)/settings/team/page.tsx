import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/primitives";
import { TeamManager } from "@/components/TeamManager";
import { Button } from "@/components/ui/button";

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team & roles"
        subtitle="Dashboard members and their scope. Create a member and assign a region or constituency."
        action={
          <Link href="/callers">
            <Button variant="outline">
              <PhoneCall /> Manage field callers
            </Button>
          </Link>
        }
      />
      <TeamManager />
    </>
  );
}
