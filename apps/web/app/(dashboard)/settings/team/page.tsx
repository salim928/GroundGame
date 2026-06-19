import { UserPlus } from "lucide-react";
import { data } from "@/lib/data";
import { Card, PageHeader, Pill } from "@/components/primitives";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  regional_coordinator: "Regional Coordinator",
  constituency_coordinator: "Constituency Coordinator",
  analyst: "Analyst",
};
const ROLE_TONE: Record<Role, "blue" | "green" | "amber" | "slate"> = {
  super_admin: "blue",
  regional_coordinator: "green",
  constituency_coordinator: "amber",
  analyst: "slate",
};

export default async function TeamPage() {
  const members = await data.members();
  return (
    <>
      <PageHeader
        title="Team & roles"
        subtitle="Dashboard members and their scope. Field callers have no login — they work in the Sheet."
        action={
          <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
            <UserPlus size={16} /> Invite member
          </button>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">Member</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Scope</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
                  <td className="py-3">
                    <div className="font-medium text-ink">{m.fullName}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="py-3">
                    <Pill tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Pill>
                  </td>
                  <td className="py-3 text-slate-600">{m.scope}</td>
                  <td className="py-3">
                    {m.isActive ? (
                      <Pill tone="green">Active</Pill>
                    ) : (
                      <Pill tone="slate">Inactive</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
